/**
 * Demo seed script
 * Run with: node seeders/demoSeed.js
 * Creates two complementary demo accounts if they don't already exist.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const User     = require('../models/User');
const Skill    = require('../models/Skill');
const UserSkill = require('../models/UserSkill');

const DEMO_USERS = [
  {
    name: 'Rahul',
    username: 'rahul_demo',
    email: 'rahul@demo.com',
    password: 'demo1234',
    bio: 'Full-stack developer passionate about React and JavaScript. Looking to learn Python and ML.',
    teaches: ['React', 'JavaScript'],
    learns:  ['Python', 'Machine Learning'],
  },
  {
    name: 'Arjun',
    username: 'arjun_demo',
    email: 'arjun@demo.com',
    password: 'demo1234',
    bio: 'Data scientist who loves Python and ML. Eager to pick up modern frontend skills.',
    teaches: ['Python', 'Machine Learning'],
    learns:  ['React', 'JavaScript'],
  },
];

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Ensure skills exist (seeder should have run at startup, but we call it just in case)
    const skillSeeder = require('./skillSeeder');
    await skillSeeder();

    for (const demo of DEMO_USERS) {
      // Skip if already exists
      const existing = await User.findOne({ email: demo.email });
      if (existing) {
        console.log(`[SKIP] ${demo.name} already exists`);
        continue;
      }

      // Create user (pre-save hook hashes the password)
      const user = await User.create({
        name: demo.name,
        username: demo.username,
        email: demo.email,
        passwordHash: demo.password,
        bio: demo.bio,
      });

      // Wire up skills
      for (const skillName of demo.teaches) {
        const skill = await Skill.findOne({ name: skillName });
        if (!skill) { console.warn(`Skill not found: ${skillName}`); continue; }
        await UserSkill.create({ userId: user._id, skillId: skill._id, type: 'teach' });
      }
      for (const skillName of demo.learns) {
        const skill = await Skill.findOne({ name: skillName });
        if (!skill) { console.warn(`Skill not found: ${skillName}`); continue; }
        await UserSkill.create({ userId: user._id, skillId: skill._id, type: 'learn' });
      }

      console.log(`[OK] Created demo user: ${demo.name} (${demo.email}) pw: ${demo.password}`);
    }

    console.log('\nDemo seed complete.');
    console.log('Rahul teaches: React, JavaScript  |  wants: Python, Machine Learning');
    console.log('Arjun teaches: Python, Machine Learning  |  wants: React, JavaScript');
    console.log('Expected match score: 100%');
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    process.exit(process.exitCode || 0);
  }
};

run();
