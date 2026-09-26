// Skill and role taxonomy used by the offline (no-AI) resume parser and by
// the matcher. Keys are canonical names; values are lowercase aliases.

export const SKILLS = {
  // Programming languages
  JavaScript: ['javascript', 'js', 'es6', 'ecmascript'],
  TypeScript: ['typescript', 'ts'],
  Python: ['python', 'python3'],
  Java: ['java', 'j2ee', 'jvm'],
  Kotlin: ['kotlin'],
  Go: ['golang', 'go lang'],
  Rust: ['rust'],
  'C#': ['c#', 'csharp', 'c sharp'],
  'C++': ['c++', 'cpp'],
  C: ['c programming', 'ansi c'],
  PHP: ['php'],
  Ruby: ['ruby'],
  Swift: ['swift'],
  'Objective-C': ['objective-c', 'objective c'],
  Scala: ['scala'],
  Dart: ['dart'],
  R: ['r programming', 'rstudio'],
  MATLAB: ['matlab'],
  SQL: ['sql', 't-sql', 'pl/sql', 'plsql'],
  Bash: ['bash', 'shell scripting', 'shell script'],
  Solidity: ['solidity'],
  // Frontend
  React: ['react', 'react.js', 'reactjs'],
  'Next.js': ['next.js', 'nextjs'],
  Vue: ['vue', 'vue.js', 'vuejs', 'nuxt'],
  Angular: ['angular', 'angularjs'],
  Svelte: ['svelte', 'sveltekit'],
  HTML: ['html', 'html5'],
  CSS: ['css', 'css3', 'sass', 'scss', 'less'],
  'Tailwind CSS': ['tailwind', 'tailwindcss'],
  Redux: ['redux'],
  // Backend
  'Node.js': ['node.js', 'nodejs', 'node', 'express', 'nestjs', 'nest.js'],
  Django: ['django'],
  Flask: ['flask'],
  FastAPI: ['fastapi'],
  Spring: ['spring', 'spring boot', 'springboot'],
  '.NET': ['.net', 'dotnet', 'asp.net', '.net core'],
  Laravel: ['laravel'],
  Rails: ['rails', 'ruby on rails'],
  GraphQL: ['graphql'],
  'REST APIs': ['restful', 'rest api', 'rest apis'],
  gRPC: ['grpc'],
  Microservices: ['microservices', 'micro-services', 'microservice'],
  // Mobile
  Android: ['android'],
  iOS: ['ios'],
  Flutter: ['flutter'],
  'React Native': ['react native', 'react-native'],
  // Data / AI
  'Machine Learning': ['machine learning', 'ml'],
  'Deep Learning': ['deep learning'],
  NLP: ['nlp', 'natural language processing'],
  'Computer Vision': ['computer vision', 'opencv'],
  LLM: ['llm', 'llms', 'large language models', 'generative ai', 'genai', 'rag', 'langchain'],
  TensorFlow: ['tensorflow', 'keras'],
  PyTorch: ['pytorch', 'torch'],
  'scikit-learn': ['scikit-learn', 'sklearn'],
  Pandas: ['pandas', 'numpy'],
  Spark: ['spark', 'pyspark', 'apache spark'],
  Airflow: ['airflow'],
  dbt: ['dbt'],
  Kafka: ['kafka'],
  'Power BI': ['power bi', 'powerbi'],
  Tableau: ['tableau'],
  Excel: ['excel', 'advanced excel'],
  Statistics: ['statistics', 'statistical analysis'],
  'Data Analysis': ['data analysis', 'data analytics', 'analytics'],
  // Databases
  PostgreSQL: ['postgresql', 'postgres'],
  MySQL: ['mysql', 'mariadb'],
  MongoDB: ['mongodb', 'mongo'],
  Redis: ['redis'],
  Elasticsearch: ['elasticsearch', 'elastic', 'opensearch'],
  'SQL Server': ['sql server', 'mssql'],
  Oracle: ['oracle db', 'oracle database'],
  // Cloud / DevOps
  AWS: ['aws', 'amazon web services', 'ec2', 's3', 'lambda'],
  Azure: ['azure'],
  GCP: ['gcp', 'google cloud'],
  Docker: ['docker', 'containers'],
  Kubernetes: ['kubernetes', 'k8s', 'helm', 'openshift'],
  Terraform: ['terraform', 'iac', 'infrastructure as code'],
  Ansible: ['ansible'],
  'CI/CD': ['ci/cd', 'cicd', 'jenkins', 'github actions', 'gitlab ci', 'continuous integration'],
  Linux: ['linux', 'unix', 'ubuntu', 'centos', 'debian'],
  Git: ['git', 'github', 'gitlab', 'bitbucket'],
  Networking: ['networking', 'tcp/ip', 'ccna', 'cisco', 'routing', 'switching'],
  'Cyber Security': ['security', 'cybersecurity', 'cyber security', 'penetration testing', 'pentest', 'siem', 'soc', 'owasp'],
  Prometheus: ['prometheus', 'grafana'],
  // Testing / process
  Testing: ['unit testing', 'jest', 'pytest', 'selenium', 'cypress', 'playwright', 'qa', 'test automation', 'junit'],
  Agile: ['agile', 'scrum', 'kanban', 'jira'],
  // Design / product / marketing
  Figma: ['figma', 'sketch', 'adobe xd'],
  'UI/UX': ['ui/ux', 'ux', 'ui design', 'user experience', 'user research', 'wireframing', 'prototyping'],
  Photoshop: ['photoshop', 'illustrator', 'adobe creative suite', 'indesign'],
  'Product Management': ['product management', 'product owner', 'roadmap', 'product strategy'],
  'Project Management': ['project management', 'pmp', 'prince2'],
  SEO: ['seo', 'search engine optimization'],
  'Digital Marketing': ['digital marketing', 'google ads', 'sem', 'ppc', 'social media marketing', 'content marketing', 'email marketing'],
  Copywriting: ['copywriting', 'content writing', 'technical writing'],
  // Business / finance
  Accounting: ['accounting', 'ifrs', 'gaap', 'bookkeeping', 'financial reporting'],
  'Financial Analysis': ['financial analysis', 'financial modeling', 'valuation', 'fp&a'],
  SAP: ['sap', 'sap erp', 's/4hana'],
  Salesforce: ['salesforce', 'crm'],
  Sales: ['sales', 'business development', 'b2b sales', 'account management'],
  'Customer Support': ['customer support', 'customer service', 'help desk', 'helpdesk'],
  // Engineering / science / health
  AutoCAD: ['autocad', 'revit', 'civil 3d'],
  SolidWorks: ['solidworks', 'catia', 'creo', 'cad'],
  PLC: ['plc', 'scada', 'automation engineering', 'siemens tia'],
  'Electrical Engineering': ['electrical engineering', 'power systems', 'circuit design', 'pcb'],
  'Mechanical Engineering': ['mechanical engineering', 'hvac', 'thermodynamics'],
  'Civil Engineering': ['civil engineering', 'structural engineering', 'construction management'],
  Embedded: ['embedded', 'firmware', 'microcontroller', 'rtos', 'arm cortex', 'fpga', 'vhdl', 'verilog'],
  Nursing: ['nursing', 'registered nurse', 'patient care', 'icu'],
  Medicine: ['physician', 'medical doctor', 'clinical'],
  Pharmacy: ['pharmacy', 'pharmacist'],
  Teaching: ['teaching', 'teacher', 'curriculum', 'tutoring'],
  Translation: ['translation', 'translator', 'interpreting', 'localization'],
};

// Role families drive search queries, visa shortage checks and freelance ideas.
export const ROLE_FAMILIES = {
  software: {
    label: 'Software Engineering',
    keywords: ['developer', 'software engineer', 'programmer', 'full stack', 'fullstack', 'frontend', 'front-end', 'backend', 'back-end', 'web developer', 'mobile developer'],
    skills: ['JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js', 'Go', 'C#', 'PHP', 'Kotlin', 'Swift', 'Flutter'],
    queries: ['software engineer', 'full stack developer', 'backend developer', 'frontend developer'],
    shortage: true,
    freelance: ['Web app development', 'API / backend development', 'Bug fixing & performance tuning', 'Mobile app development'],
  },
  data: {
    label: 'Data & AI',
    keywords: ['data scientist', 'data analyst', 'data engineer', 'machine learning engineer', 'ml engineer', 'ai engineer', 'bi developer', 'analytics engineer'],
    skills: ['Machine Learning', 'Deep Learning', 'Pandas', 'SQL', 'Spark', 'PyTorch', 'TensorFlow', 'LLM', 'Power BI', 'Tableau', 'Data Analysis', 'Statistics'],
    queries: ['data scientist', 'machine learning engineer', 'data engineer', 'data analyst'],
    shortage: true,
    freelance: ['Dashboards & BI reports', 'Data cleaning & analysis', 'ML model development', 'LLM / chatbot integration'],
  },
  devops: {
    label: 'DevOps & Cloud',
    keywords: ['devops', 'site reliability', 'sre', 'cloud engineer', 'platform engineer', 'infrastructure engineer', 'system administrator', 'sysadmin'],
    skills: ['AWS', 'Azure', 'GCP', 'Kubernetes', 'Docker', 'Terraform', 'CI/CD', 'Linux', 'Ansible'],
    queries: ['devops engineer', 'cloud engineer', 'site reliability engineer', 'platform engineer'],
    shortage: true,
    freelance: ['CI/CD pipeline setup', 'Cloud migration & cost optimisation', 'Kubernetes / Docker setup', 'Server hardening & monitoring'],
  },
  security: {
    label: 'Cyber Security',
    keywords: ['security engineer', 'security analyst', 'penetration tester', 'soc analyst', 'cyber security'],
    skills: ['Cyber Security', 'Networking', 'Linux'],
    queries: ['security engineer', 'security analyst', 'penetration tester'],
    shortage: true,
    freelance: ['Security audits & pentests', 'Bug bounty', 'Security hardening'],
  },
  qa: {
    label: 'QA & Testing',
    keywords: ['qa engineer', 'test engineer', 'quality assurance', 'sdet', 'tester'],
    skills: ['Testing'],
    queries: ['qa engineer', 'test automation engineer'],
    shortage: true,
    freelance: ['Test automation', 'Manual QA testing'],
  },
  design: {
    label: 'Design',
    keywords: ['designer', 'ui designer', 'ux designer', 'product designer', 'graphic designer'],
    skills: ['Figma', 'UI/UX', 'Photoshop'],
    queries: ['product designer', 'ux designer', 'ui designer'],
    shortage: false,
    freelance: ['UI/UX design', 'Landing page design', 'Brand & logo design'],
  },
  product: {
    label: 'Product & Project Management',
    keywords: ['product manager', 'product owner', 'project manager', 'scrum master', 'program manager'],
    skills: ['Product Management', 'Project Management', 'Agile'],
    queries: ['product manager', 'project manager', 'scrum master'],
    shortage: false,
    freelance: ['Fractional product management', 'Project coordination'],
  },
  marketing: {
    label: 'Marketing & Content',
    keywords: ['marketing', 'seo specialist', 'content writer', 'copywriter', 'social media', 'growth'],
    skills: ['SEO', 'Digital Marketing', 'Copywriting'],
    queries: ['digital marketing manager', 'seo specialist', 'content marketing'],
    shortage: false,
    freelance: ['SEO audits', 'Content writing', 'Paid ads management', 'Social media management'],
  },
  finance: {
    label: 'Finance & Accounting',
    keywords: ['accountant', 'financial analyst', 'controller', 'auditor', 'finance'],
    skills: ['Accounting', 'Financial Analysis', 'Excel', 'SAP'],
    queries: ['financial analyst', 'accountant'],
    shortage: false,
    freelance: ['Bookkeeping', 'Financial modelling', 'Excel automation'],
  },
  engineering: {
    label: 'Engineering (non-software)',
    keywords: ['mechanical engineer', 'electrical engineer', 'civil engineer', 'automation engineer', 'embedded engineer', 'hardware engineer'],
    skills: ['AutoCAD', 'SolidWorks', 'PLC', 'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Embedded'],
    queries: ['electrical engineer', 'mechanical engineer', 'embedded engineer', 'civil engineer'],
    shortage: true,
    freelance: ['CAD drafting', 'PLC programming', 'Embedded firmware'],
  },
  healthcare: {
    label: 'Healthcare',
    keywords: ['nurse', 'doctor', 'physician', 'pharmacist', 'caregiver', 'physiotherapist'],
    skills: ['Nursing', 'Medicine', 'Pharmacy'],
    queries: ['registered nurse', 'physician', 'pharmacist'],
    shortage: true,
    freelance: ['Medical writing', 'Telehealth consulting'],
  },
  education: {
    label: 'Education & Languages',
    keywords: ['teacher', 'lecturer', 'tutor', 'translator', 'interpreter'],
    skills: ['Teaching', 'Translation'],
    queries: ['teacher', 'translator'],
    shortage: false,
    freelance: ['Online tutoring', 'Translation (Persian ⇄ English)', 'Localization'],
  },
  sales: {
    label: 'Sales & Customer Success',
    keywords: ['sales', 'account executive', 'business development', 'customer success', 'support specialist'],
    skills: ['Sales', 'Salesforce', 'Customer Support'],
    queries: ['account executive', 'customer success manager', 'business development'],
    shortage: false,
    freelance: ['Lead generation', 'Customer support outsourcing'],
  },
};

export const LANGUAGES = {
  English: ['english'],
  German: ['german', 'deutsch'],
  French: ['french', 'français', 'francais'],
  Dutch: ['dutch', 'nederlands'],
  Spanish: ['spanish', 'español', 'espanol'],
  Italian: ['italian'],
  Portuguese: ['portuguese'],
  Swedish: ['swedish'],
  Turkish: ['turkish'],
  Arabic: ['arabic'],
  Russian: ['russian'],
  Persian: ['persian', 'farsi'],
  Chinese: ['chinese', 'mandarin'],
  Japanese: ['japanese'],
};

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Word-boundary regex that also works for tokens like "c#", ".net", "node.js".
export function aliasRegex(alias) {
  return new RegExp(`(^|[^a-z0-9+#.])${escape(alias)}(?=$|[^a-z0-9+#])`, 'i');
}

const compiled = Object.entries(SKILLS).map(([name, aliases]) => [name, aliases.map(aliasRegex)]);

export function findSkills(text = '') {
  const lower = ` ${text.toLowerCase()} `;
  return compiled.filter(([, regs]) => regs.some((r) => r.test(lower))).map(([name]) => name);
}

export function canonicalSkill(raw = '') {
  const s = raw.toLowerCase().trim();
  for (const [name, aliases] of Object.entries(SKILLS)) {
    if (name.toLowerCase() === s || aliases.includes(s)) return name;
  }
  return raw.trim();
}
