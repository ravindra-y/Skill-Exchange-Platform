const Skill = require('../models/Skill');

const initialSkills = [
  { name: 'Java', category: 'Programming' },
  { name: 'Python', category: 'Programming' },
  { name: 'JavaScript', category: 'Programming' },
  { name: 'TypeScript', category: 'Programming' },
  { name: 'React', category: 'Web Development' },
  { name: 'Node.js', category: 'Web Development' },
  { name: 'SQL', category: 'Database' },
  { name: 'Machine Learning', category: 'Data Science' },
  { name: 'UI/UX', category: 'Design' },
  { name: 'Figma', category: 'Design' },
  { name: 'Photoshop', category: 'Design' },
  { name: 'Video Editing', category: 'Media' },
  { name: 'Public Speaking', category: 'Soft Skills' }
];

const seedSkills = async () => {
  try {
    const count = await Skill.countDocuments();
    if (count === 0) {
      await Skill.insertMany(initialSkills);
      console.log('Skills seeded successfully');
    }
  } catch (error) {
    console.error('Error seeding skills:', error);
  }
};

module.exports = seedSkills;
