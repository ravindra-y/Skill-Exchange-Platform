const fs = require('fs');
const path = require('path');

// Robust CSV parser
function parseCSV(text) {
  const rows = [];
  let row = [];
  let token = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        token += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(token);
      token = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(token);
      token = '';
      if (row.length > 1) rows.push(row);
      row = [];
    } else {
      token += c;
    }
  }
  if (token.length > 0 || row.length > 0) {
    row.push(token);
    if (row.length > 1) rows.push(row);
  }
  return rows;
}

function cleanLabel(label) {
  if (!label) return '';
  return label.trim();
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Format canonical display name (e.g., "Python (computer programming)" -> "Python")
function getDisplayName(preferredLabel) {
  const m = preferredLabel.match(/^(.+?)\s*\((computer programming|programming language|software)\)$/i);
  if (m) {
    return m[1].trim();
  }
  return preferredLabel;
}

console.log('Building ESCO Skills Index...');

// 1. Load skillGroups_en.csv
const groups = {};
if (fs.existsSync(path.join(__dirname, '../data/skillGroups_en.csv'))) {
  const groupRows = parseCSV(fs.readFileSync(path.join(__dirname, '../data/skillGroups_en.csv'), 'utf8'));
  for (let i = 1; i < groupRows.length; i++) {
    const r = groupRows[i];
    const uri = r[1];
    const label = r[2];
    if (uri && label) {
      groups[uri] = cleanLabel(label);
    }
  }
}
console.log('Loaded groups:', Object.keys(groups).length);

// 2. Load broaderRelationsSkillPillar_en.csv
const broaderGroupMap = {};
if (fs.existsSync(path.join(__dirname, '../data/broaderRelationsSkillPillar_en.csv'))) {
  const broaderRows = parseCSV(fs.readFileSync(path.join(__dirname, '../data/broaderRelationsSkillPillar_en.csv'), 'utf8'));
  for (let i = 1; i < broaderRows.length; i++) {
    const r = broaderRows[i];
    const skillUri = r[1];
    const broaderUri = r[3];
    if (skillUri && broaderUri) {
      if (groups[broaderUri] && !broaderGroupMap[skillUri]) {
        broaderGroupMap[skillUri] = groups[broaderUri];
      }
    }
  }
}
console.log('Loaded broader relations for skills:', Object.keys(broaderGroupMap).length);

// 3. Load digitalSkillsCollection_en.csv for digital skill categories
const digitalCatMap = {};
if (fs.existsSync(path.join(__dirname, '../data/digitalSkillsCollection_en.csv'))) {
  const digitalRows = parseCSV(fs.readFileSync(path.join(__dirname, '../data/digitalSkillsCollection_en.csv'), 'utf8'));
  for (let i = 1; i < digitalRows.length; i++) {
    const r = digitalRows[i];
    const skillUri = r[1];
    const broaderPT = r[9]; // e.g. "computer programming | software and applications development and analysis"
    if (skillUri && broaderPT) {
      const parts = broaderPT.split('|').map(s => s.trim()).filter(Boolean);
      digitalCatMap[skillUri] = parts[0] || parts[1];
    }
  }
}
console.log('Loaded digital skill categories:', Object.keys(digitalCatMap).length);

// 4. Curated Modern Tech Skills & Canonical Aliases
// These ensure modern software engineering terms (React, Node, Docker, AWS, etc.)
// map instantly to canonical items with complete alias sets and accurate categories.
const curatedTechSkills = [
  {
    name: 'Python',
    canonicalName: 'Python',
    category: 'Programming Languages',
    escoUri: 'http://data.europa.eu/esco/skill/ccd0a1d9-afda-43d9-b901-96344886e14d',
    aliases: ['Python 3', 'Python3', 'Python programming', 'Python scripting', 'Py3k', 'Pyston', 'Python 2'],
    description: 'General-purpose programming language widely used in web development, data science, automation, and AI.'
  },
  {
    name: 'Java',
    canonicalName: 'Java',
    category: 'Programming Languages',
    escoUri: 'http://data.europa.eu/esco/skill/19a8293b-8e95-4de3-983f-77484079c389',
    aliases: ['Java programming', 'Java SE', 'Java EE', 'Java JDK', 'Java language'],
    description: 'Object-oriented programming language designed to have as few implementation dependencies as possible.'
  },
  {
    name: 'JavaScript',
    canonicalName: 'JavaScript',
    category: 'Programming Languages',
    escoUri: 'http://data.europa.eu/esco/skill/442da6fa-a837-4bf7-bf07-88746ebf4b5d',
    aliases: ['JS', 'ES6', 'ECMAScript', 'Modern JavaScript', 'Vanilla JS'],
    description: 'High-level, interpreted scripting language conforming to the ECMAScript specification for web development.'
  },
  {
    name: 'TypeScript',
    canonicalName: 'TypeScript',
    category: 'Programming Languages',
    escoUri: 'http://data.europa.eu/esco/skill/c4e207d2-7ba4-41d3-a4e9-11ba107c9196',
    aliases: ['TS', 'TypeScript programming'],
    description: 'Strict syntactical superset of JavaScript that adds optional static typing.'
  },
  {
    name: 'React',
    canonicalName: 'React',
    category: 'Web Development',
    aliases: ['React.js', 'React JS', 'ReactJS', 'React framework', 'React frontend'],
    description: 'Declarative, component-based front-end JavaScript library for building user interfaces.'
  },
  {
    name: 'Node.js',
    canonicalName: 'Node.js',
    category: 'Web Development',
    aliases: ['Node', 'NodeJS', 'Node JS', 'Node runtime', 'Node.js backend'],
    description: 'Open-source, cross-platform JavaScript runtime environment executing JavaScript code server-side.'
  },
  {
    name: 'Angular',
    canonicalName: 'Angular',
    category: 'Web Development',
    aliases: ['AngularJS', 'Angular.js', 'Angular JS', 'Angular 2+', 'Angular framework'],
    description: 'TypeScript-based, free and open-source web application framework led by the Angular Team at Google.'
  },
  {
    name: 'Vue.js',
    canonicalName: 'Vue.js',
    category: 'Web Development',
    aliases: ['Vue', 'VueJS', 'Vue JS', 'Vue.js framework'],
    description: 'Progressive JavaScript framework for building user interfaces and single-page applications.'
  },
  {
    name: 'C++',
    canonicalName: 'C++',
    category: 'Programming Languages',
    escoUri: 'http://data.europa.eu/esco/skill/2a11bdf2-f8c5-4ceb-8ea3-a8e52db352ee',
    aliases: ['CPP', 'C plus plus', 'Microsoft Visual C++', 'Visual C++'],
    description: 'General-purpose programming language created as an extension of the C programming language.'
  },
  {
    name: 'C#',
    canonicalName: 'C#',
    category: 'Programming Languages',
    escoUri: 'http://data.europa.eu/esco/skill/7f4a2754-05bb-41bb-b3b3-82aa9c792167',
    aliases: ['CSharp', 'C Sharp', 'C# .NET', 'Dotnet C#'],
    description: 'Modern, object-oriented, and type-safe programming language developed by Microsoft.'
  },
  {
    name: 'SQL',
    canonicalName: 'SQL',
    category: 'Database Systems',
    escoUri: 'http://data.europa.eu/esco/skill/90412854-e692-4f3d-9d4d-f95c0dc36b4d',
    aliases: ['Structured Query Language', 'SQL query', 'Relational database SQL', 'RDBMS SQL', 'SQL database'],
    description: 'Domain-specific language used in programming and designed for managing data held in relational databases.'
  },
  {
    name: 'MongoDB',
    canonicalName: 'MongoDB',
    category: 'Database Systems',
    aliases: ['Mongo', 'NoSQL MongoDB', 'MongoDB database', 'Mongoose'],
    description: 'Source-available, cross-platform, document-oriented NoSQL database program.'
  },
  {
    name: 'PostgreSQL',
    canonicalName: 'PostgreSQL',
    category: 'Database Systems',
    aliases: ['Postgres', 'Postgres SQL', 'PGSQL', 'PostgreSQL database'],
    description: 'Powerful, open-source object-relational database system with over 35 years of active development.'
  },
  {
    name: 'AWS',
    canonicalName: 'AWS (Amazon Web Services)',
    category: 'Cloud Technologies',
    aliases: ['AWS', 'Amazon Web Services', 'AWS Cloud', 'Amazon Cloud', 'EC2', 'S3'],
    description: 'Comprehensive, evolving cloud computing platform provided by Amazon that includes infrastructure as a service (IaaS).'
  },
  {
    name: 'Azure',
    canonicalName: 'Microsoft Azure',
    category: 'Cloud Technologies',
    aliases: ['Azure', 'Microsoft Azure Cloud', 'Azure DevOps', 'Azure Cloud'],
    description: 'Cloud computing platform operated by Microsoft for application management via Microsoft-managed data centers.'
  },
  {
    name: 'Docker',
    canonicalName: 'Docker',
    category: 'DevOps & Cloud',
    aliases: ['Docker container', 'Docker containers', 'Containerization', 'Dockerfile', 'Docker Compose'],
    description: 'Platform as a service product that uses OS-level virtualization to deliver software in packages called containers.'
  },
  {
    name: 'Kubernetes',
    canonicalName: 'Kubernetes',
    category: 'DevOps & Cloud',
    aliases: ['K8s', 'Kubernetes cluster', 'Container orchestration', 'K8s cluster'],
    description: 'Open-source system for automating deployment, scaling, and management of containerised applications.'
  },
  {
    name: 'Machine Learning',
    canonicalName: 'Machine Learning',
    category: 'Data Science & AI',
    escoUri: 'http://data.europa.eu/esco/skill/2f44ad9d-e4a8-43bb-a15e-be9221147a46',
    aliases: ['ML', 'Supervised learning', 'Unsupervised learning', 'Machine learning algorithms'],
    description: 'Field of inquiry devoted to understanding and building methods that learn from data to improve performance.'
  },
  {
    name: 'Deep Learning',
    canonicalName: 'Deep Learning',
    category: 'Data Science & AI',
    escoUri: 'http://data.europa.eu/esco/skill/0b6863c3-1ef9-42b6-a94f-f9f36f6d90a9',
    aliases: ['DL', 'Neural networks', 'Artificial neural networks', 'Deep neural networks'],
    description: 'Subset of machine learning methods based on artificial neural networks with representation learning.'
  },
  {
    name: 'TensorFlow',
    canonicalName: 'TensorFlow',
    category: 'Data Science & AI',
    aliases: ['TF', 'Tensorflow framework', 'Keras TensorFlow'],
    description: 'Free and open-source software library for machine learning and artificial intelligence developed by Google.'
  },
  {
    name: 'PyTorch',
    canonicalName: 'PyTorch',
    category: 'Data Science & AI',
    aliases: ['Torch', 'PyTorch deep learning'],
    description: 'Machine learning framework based on the Torch library, used for applications such as computer vision and natural language processing.'
  },
  {
    name: 'Figma',
    canonicalName: 'Figma',
    category: 'Design & UI/UX',
    aliases: ['Figma design', 'Figma UI', 'Figma UX', 'Figma prototyping'],
    description: 'Collaborative web application for interface design, vector graphics editor, and prototyping tool.'
  },
  {
    name: 'Git',
    canonicalName: 'Git',
    category: 'Software Development Tools',
    aliases: ['Git version control', 'Git VCS', 'Git repository'],
    description: 'Distributed version control system that tracks changes in any set of computer files, usually used for coordinating work among programmers.'
  },
  {
    name: 'GitHub',
    canonicalName: 'GitHub',
    category: 'Software Development Tools',
    aliases: ['GitHub platform', 'GitHub Actions', 'GitHub VCS'],
    description: 'Platform and cloud-based service for software development and version control using Git.'
  },
  {
    name: 'UI/UX Design',
    canonicalName: 'UI/UX Design',
    category: 'Design',
    aliases: ['UI/UX', 'UI Design', 'UX Design', 'User Interface Design', 'User Experience Design'],
    description: 'Design of user interfaces and overall user experience for machines, software, websites, and mobile applications.'
  }
];

// Map of canonical name to item for fast deduplication
const skillsMap = new Map();

// First add curated skills
curatedTechSkills.forEach(item => {
  skillsMap.set(item.canonicalName.toLowerCase(), {
    id: item.escoUri || `custom-${item.canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    name: item.canonicalName,
    canonicalName: item.canonicalName,
    category: item.category,
    aliases: item.aliases,
    description: item.description,
    isCurated: true
  });
});

// 5. Parse skills_en.csv and merge all ESCO skills
const skillsCsvPath = path.join(__dirname, '../data/skills_en.csv');
if (fs.existsSync(skillsCsvPath)) {
  const rows = parseCSV(fs.readFileSync(skillsCsvPath, 'utf8'));
  console.log('Parsing skills_en.csv rows:', rows.length);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const uri = r[1];
    const skillType = r[2]; // 'skill/competence', 'knowledge'
    const rawPref = cleanLabel(r[4]);
    if (!uri || !rawPref) continue;

    const alts = r[5] ? r[5].split('\n').map(s => cleanLabel(s)).filter(Boolean) : [];
    const description = r[12] ? cleanLabel(r[12]) : '';

    const displayName = capitalize(getDisplayName(rawPref));
    const key = displayName.toLowerCase();

    // Determine category
    let category = digitalCatMap[uri] || broaderGroupMap[uri];
    if (!category) {
      if (rawPref.toLowerCase().includes('programming') || rawPref.toLowerCase().includes('software')) {
        category = 'Software & applications development';
      } else if (rawPref.toLowerCase().includes('data') || rawPref.toLowerCase().includes('analytics')) {
        category = 'Data & analytics';
      } else if (skillType === 'knowledge') {
        category = 'Knowledge';
      } else {
        category = 'General skill';
      }
    }
    category = capitalize(category);

    if (skillsMap.has(key)) {
      // Merge with existing
      const existing = skillsMap.get(key);
      const combinedAliases = Array.from(new Set([...existing.aliases, ...alts, rawPref]));
      existing.aliases = combinedAliases.filter(a => a.toLowerCase() !== existing.name.toLowerCase());
      if (!existing.escoUri && uri) existing.escoUri = uri;
      if (!existing.description && description) existing.description = description;
    } else {
      skillsMap.set(key, {
        id: uri,
        name: displayName,
        canonicalName: displayName,
        category: category,
        aliases: alts.filter(a => a.toLowerCase() !== displayName.toLowerCase()),
        description: description,
        isCurated: false
      });
    }
  }
}

const allSkills = Array.from(skillsMap.values());
console.log('Total indexed skills:', allSkills.length);

// Save to backend/data/esco_skills_index.json
const outputPath = path.join(__dirname, '../data/esco_skills_index.json');
fs.writeFileSync(outputPath, JSON.stringify(allSkills));
console.log('Successfully written index to:', outputPath);
console.log('File size:', (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2), 'MB');
