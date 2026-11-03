const mongoose = require('mongoose');
const { Schema } = mongoose;

const User = mongoose.model(
  'User',
  new Schema(
    {
      username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },
      email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ['admin', 'student'], default: 'student' },
      studentRef: {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        default: null,
      },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
  )
);

const classSchema = new Schema(
  {
    gradeName: { type: String, required: true, trim: true },
    sectionName: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);
classSchema.index({ gradeName: 1, sectionName: 1 }, { unique: true });
const ClassSection = mongoose.model('ClassSection', classSchema);

const studentSchema = new Schema(
  {
    studentId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true }, // for index-friendly prefix search
    email: { type: String, required: true, trim: true },
    emailLower: { type: String, required: true, unique: true },
    phone: { type: String, required: true, trim: true, match: [/^\d{10}$/, 'Phone number must be 10 digits'] },
    classSectionId: {
      type: Schema.Types.ObjectId,
      ref: 'ClassSection',
      required: true,
    },
    admissionDate: { type: Date, required: true },
    dob: { type: Date, required: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
    version: { type: Number, default: 0 }, // optimistic locking
  },
  { timestamps: true, versionKey: false }
);
studentSchema.index({ classSectionId: 1, status: 1, nameLower: 1 });
studentSchema.index({ status: 1, nameLower: 1, _id: 1 });
studentSchema.index({ nameLower: 1, _id: 1 });
studentSchema.index({ admissionDate: 1, _id: 1 });
studentSchema.index({ dob: 1, _id: 1 });
const Student = mongoose.model('Student', studentSchema);

const IdempotencyKey = mongoose.model(
  'IdempotencyKey',
  new Schema({
    _id: String,
    status: Number,
    body: Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now, expires: 86400 },
  })
);

module.exports = { User, ClassSection, Student, IdempotencyKey };
