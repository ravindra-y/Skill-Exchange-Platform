const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  bio: {
    type: String,
    default: '',
  },
  avatarUrl: {
    type: String,
    default: '',
  },
  isAvailable: {
    type: Boolean,
    default: true,
  },
  socialLinks: {
    github: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    website: { type: String, default: '' },
  },
  accountNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  hoursTaught: {
    type: Number,
    default: 0,
  }
}, {
  timestamps: true,
});

userSchema.pre('save', async function () {
  // Mongoose 9: async hooks must NOT call next() — just return.
  // next is NOT a function in async hooks; Mongoose uses the resolved/rejected promise.
  if (!this.isModified('passwordHash')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
