require('dotenv/config');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, ClassSection, Student } = require('./models');

// 5 sample students. Each one also gets a login account (email + password).
const STUDENT_PASSWORD = 'Student@123';
const STUDENTS = [
  { studentId: 'STU000001', name: 'Aarav Kumar',   email: 'aarav.kumar@school.test',   phone: '9876543210', grade: 'Grade 1', section: 'A', admissionDate: '2021-06-01', dob: '2015-04-12' },
  { studentId: 'STU000002', name: 'Diya Nair',     email: 'diya.nair@school.test',     phone: '9876543211', grade: 'Grade 1', section: 'B', admissionDate: '2021-06-01', dob: '2015-08-23' },
  { studentId: 'STU000003', name: 'Karthik Raj',   email: 'karthik.raj@school.test',   phone: '9876543212', grade: 'Grade 2', section: 'A', admissionDate: '2022-06-01', dob: '2014-01-30' },
  { studentId: 'STU000004', name: 'Meera Iyer',    email: 'meera.iyer@school.test',    phone: '9876543213', grade: 'Grade 2', section: 'B', admissionDate: '2022-06-01', dob: '2014-11-05' },
  { studentId: 'STU000005', name: 'Nikhil Sharma', email: 'nikhil.sharma@school.test', phone: '9876543214', grade: 'Grade 3', section: 'A', admissionDate: '2023-06-01', dob: '2013-07-19' },
];

const hash = (p) => bcrypt.hashSync(p, 12);

const ensureSection = (gradeName, sectionName) =>
  ClassSection.findOneAndUpdate(
    { gradeName, sectionName },
    { $setOnInsert: { description: `${gradeName} ${sectionName}` } },
    { upsert: true, new: true }
  );

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  // admin account
  await User.updateOne(
    { username: 'admin' },
    { $setOnInsert: { email: 'admin@school.test', passwordHash: hash('Admin@123'), role: 'admin' } },
    { upsert: true }
  );

  for (const s of STUDENTS) {
    const cs = await ensureSection(s.grade, s.section);

    const student = await Student.findOneAndUpdate(
      { studentId: s.studentId },
      {
        $setOnInsert: {
          studentId: s.studentId,
          name: s.name,
          nameLower: s.name.toLowerCase(),
          email: s.email,
          emailLower: s.email.toLowerCase(),
          phone: s.phone,
          classSectionId: cs._id,
          admissionDate: new Date(s.admissionDate),
          dob: new Date(s.dob),
          status: 'Active',
        },
      },
      { upsert: true, new: true }
    );

    // login account so the student can sign in with their email + password
    await User.updateOne(
      { email: s.email },
      {
        $setOnInsert: {
          username: s.email.split('@')[0],
          email: s.email,
          passwordHash: hash(STUDENT_PASSWORD),
          role: 'student',
          studentRef: student._id,
        },
      },
      { upsert: true }
    );
  }

  console.log(`Seeded ${STUDENTS.length} students.`);
  console.log('Admin   -> admin@school.test / Admin@123');
  console.log(`Student -> ${STUDENTS[0].email} / ${STUDENT_PASSWORD}`);
  await mongoose.disconnect();
}

seed().catch((err) => { console.error(err); process.exit(1); });
