// Realistic sample data so the dashboards look alive before real cards are uploaded.
// Every row is flagged is_demo = true and can be removed in Settings -> "Clear demo data".
import { iso, today, addDays, weekStart, daysBetween, parseDay } from './journey.js';

function rng(seed) { // deterministic, so the demo looks the same on every device
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const SURNAMES = ['Adeyemi','Okafor','Bello','Eze','Ogunleye','Nwosu','Balogun','Okonkwo','Adebayo','Ibrahim','Ojo','Uche','Akande','Obi','Fashola','Nnamdi','Lawal','Okeke','Adeniyi','Chukwu','Bakare','Ekwueme','Salami','Onyeka','Ayodele','Iwu','Odunsi','Amadi','Olatunji','Ezeh','Afolabi','Nwachukwu','Oyelaran','Igwe','Abiodun','Etim','Bassey','Ogbonna','Alabi','Udo'];
const MALE = ['Tunde','Chidi','Emeka','Segun','Ifeanyi','David','Samuel','Kunle','Femi','Obinna','Daniel','Joshua','Tobi','Uchenna','Seyi','Michael','Ayo','Chinedu','Gbenga','Victor'];
const FEMALE = ['Funke','Ngozi','Amaka','Blessing','Grace','Tolu','Chioma','Kemi','Esther','Adaeze','Bisi','Nkechi','Folake','Ruth','Ifeoma','Temi','Joy','Precious','Yetunde','Ada'];
const TOWNS = [['Lekki','Eti-Osa'],['Ajah','Eti-Osa'],['Victoria Island','Eti-Osa'],['Ikoyi','Eti-Osa'],['Sangotedo','Eti-Osa'],['Chevron','Eti-Osa'],['Ikota','Eti-Osa'],['Osapa London','Eti-Osa'],['Agungi','Eti-Osa'],['Oniru','Eti-Osa'],['Badore','Eti-Osa'],['Abijo','Ibeju-Lekki'],['Awoyaya','Ibeju-Lekki'],['Lakowe','Ibeju-Lekki']];
const STOPS = ['Jakande','Chevron Roundabout','Ikota','Agungi','Ajah Under Bridge','Abraham Adesanya','Lekki Phase 1 Gate','Osapa','Igbo Efon','VGC','Sangotedo','Lekki Toll Gate'];
const STREETS = ['Admiralty Way','Fola Osibo Rd','Chevron Drive','Ologolo Rd','Oral Estate','Ikota Villa Estate','VGC Estate','Freedom Way','Bourdillon Rd','Ajose Adeogun St','Abraham Adesanya Estate','Thomas Estate'];
const AGES = [['15-20',8],['21-25',20],['26-30',24],['31-35',18],['36-40',12],['41-45',8],['46-50',5],['50 & above',5]];
const SECTORS = [['Student',14],['Career Professional',26],['Self-employed',18],['Business Owner',12],['Government Worker',6],['Education',6],['NGO',3],['Unemployed',8]];
const OCCUPATIONS = ['Software Engineer','Banker','Accountant','Nurse','Fashion Designer','Lawyer','Teacher','Sales Executive','Doctor','Product Designer','Caterer','Real Estate Agent','Content Creator','Civil Engineer','Student','HR Manager','Pharmacist','Marketer','Photographer','Data Analyst'];
const INTERESTS = ['Technology','Fashion and Lifestyle','Public Sector','Private Sector','Family Life','Media','Others'];
const HEARD = [['A friend/ Family',42],['Instagram/ Facebook/ Twitter',22],['YouTube',12],['Passing by our venue',12],['Billboard/ Lampost',7],['TV/ Others',5]];
const NEEDS = ['Grow spiritually and find a church family','Career growth and good mentors','Find a good community of young professionals','Learn more about the Bible','Serve in the media team','Business breakthrough and wisdom','Healing for my family','Direction for the next season of my life','Make new friends in Lagos','Raise my children in a godly way','',''];
const PRAYERS = ['Job promotion','Healing for my mother','Marriage','Admission into university','Financial breakthrough','Peace in my home','Travel documents','Direction for my business','','',''];
const DEPARTMENTS = ['Choir','Media','Ushering','Protocol','Children Church','Hospitality','Sanctuary Keepers','Prayer','Technical','Evangelism'];

export const DEMO_TEAM = [
  { id: 'demo-jimmy', full_name: 'Jimmy Ukaba', email: 'jimmy@elevationlekki.org', role: 'admin', active: true },
  { id: 'demo-funke', full_name: 'Funke Adeyemi', email: 'funke@elevationlekki.org', role: 'followup', active: true },
  { id: 'demo-tunde', full_name: 'Tunde Bakare', email: 'tunde@elevationlekki.org', role: 'followup', active: true },
  { id: 'demo-grace', full_name: 'Grace Okon', email: 'grace@elevationlekki.org', role: 'acquisition', active: true },
  { id: 'demo-bayo', full_name: 'Pastor Bayo Martins', email: 'bayo@elevationlekki.org', role: 'viewer', active: true },
];

export const DEFAULT_SETTINGS = {
  id: 1, church_name: 'The Elevation Church, Lekki', followup_days: 3, gt_stall_weeks: 8, departments: DEPARTMENTS,
};

export function makeDemoData({ meId, teamIds } = {}) {
  const r = rng(20261114);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const weighted = (a) => { const t = a.reduce((s, x) => s + x[1], 0); let v = r() * t; for (const [k, w] of a) { if ((v -= w) < 0) return k; } return a[0][0]; };
  const chance = (p) => r() < p;
  const t = today();
  const at = (day, h = 18) => { const d = parseDay(day); d.setHours(h, Math.floor(r() * 60)); return d.toISOString(); };
  const clampDay = (day) => (day > t ? null : day);

  const team = teamIds?.length ? teamIds : DEMO_TEAM.filter((p) => ['admin', 'followup'].includes(p.role)).map((p) => p.id);
  const guests = [], followups = [], uploads = [];
  let n = 0;
  const firstSunday = addDays(weekStart(t), -7 * 25);

  for (let w = 0; w < 26; w++) {
    const sunday = addDays(firstSunday, w * 7);
    if (sunday > t) break;
    const count = 5 + Math.round(w * 0.35) + Math.floor(r() * 7);
    const uploadId = `demo-upload-${w}`;
    if (w >= 18) uploads.push({ id: uploadId, file_name: `Guest cards ${parseDay(sunday).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.xlsx`, service_date: sunday, row_count: count, created_by: teamIds ? meId : 'demo-grace', created_at: at(addDays(sunday, 1), 11), is_demo: true });

    for (let i = 0; i < count; i++) {
      const male = chance(0.46);
      const surname = pick(SURNAMES);
      const first = pick(male ? MALE : FEMALE);
      const [town, lga] = pick(TOWNS);
      const age = daysBetween(sunday, t);
      const assigned = team[n % team.length];
      n++;
      const g = {
        id: `demo-guest-${n}`,
        first_visit: sunday, last_visit: sunday, visit_count: chance(0.18) ? 2 : 1,
        surname, other_names: first + (chance(0.3) ? ' ' + pick(male ? MALE : FEMALE) : ''),
        gender: male ? 'Male' : 'Female', age_range: weighted(AGES),
        marital_status: weighted([['Single', 55], ['Married', 38], ['Divorced/Separated/Widowed', 3], ['Prefer not to say', 4]]),
        phone: '+234' + pick(['803', '806', '813', '816', '703', '706', '810', '902', '905', '809']) + String(Math.floor(r() * 9e6) + 1e6).padStart(7, '0'),
        email: chance(0.6) ? `${first}.${surname}${Math.floor(r() * 90 + 10)}@example.com`.toLowerCase() : '',
        town, lga, area: town, bus_stop: pick(STOPS), house_no: String(Math.floor(r() * 40) + 1), street: pick(STREETS),
        sector: weighted(SECTORS), occupation: pick(OCCUPATIONS),
        interests: [...new Set([pick(INTERESTS), ...(chance(0.5) ? [pick(INTERESTS)] : [])])],
        would_join: weighted([['Yes', 58], ['Maybe', 34], ['No', 8]]),
        prayer_request: pick(PRAYERS), needs: pick(NEEDS), heard_via: [weighted(HEARD)],
        assigned_to: assigned, followed_up_at: null, gt_started_at: null, gt_completed_at: null,
        department: null, department_joined_at: null, community_joined_at: null, pathway: null, pathway_at: null, notes: '',
        upload_id: w >= 18 ? uploadId : null, is_demo: true, created_at: at(addDays(sunday, 1), 10), updated_at: at(addDays(sunday, 1), 10),
      };
      if (g.age_range === '15-20' || g.sector === 'Student') { g.occupation = 'Student'; g.sector = 'Student'; }

      // follow-up history
      const pReach = age > 14 ? 0.88 : age > 3 ? 0.7 : age >= 1 ? 0.35 : 0;
      const addF = (day, outcome, extra = {}) => followups.push({
        id: `demo-f-${followups.length + 1}`, guest_id: g.id, by_user: assigned, channel: chance(0.75) ? 'Call' : 'WhatsApp', outcome,
        notes: outcome === 'Reached' ? pick(['Glad to hear from us, will come again Sunday', 'Interested in Greatness Track', 'Asked about the media department', 'Prayed together, very warm', 'Moved recently to Lekki, looking for a church home']) : '',
        next_step_date: null, created_at: at(day, 17 + Math.floor(r() * 3)), is_demo: true, ...extra,
      });
      if (chance(pReach)) {
        const day = clampDay(addDays(sunday, 1 + Math.floor(r() * Math.min(5, Math.max(1, age)))));
        if (day) {
          if (chance(0.3)) addF(addDays(day, -1) >= addDays(sunday, 1) ? addDays(day, -1) : day, 'No answer');
          addF(day, 'Reached');
          g.followed_up_at = followups[followups.length - 1].created_at;
          const fd = day;
          if (daysBetween(fd, t) > 10 && chance(0.8)) {
            g.gt_started_at = clampDay(addDays(fd, 7 + Math.floor(r() * 14)));
            if (g.gt_started_at) {
              const fin = addDays(g.gt_started_at, 35 + Math.floor(r() * 14)); // ~6 week class
              if (fin <= t && chance(0.86)) g.gt_completed_at = fin;
            }
          }
          if (g.gt_completed_at && chance(0.72)) {
            g.department_joined_at = clampDay(addDays(g.gt_completed_at, 5 + Math.floor(r() * 18)));
            if (g.department_joined_at) g.department = pick(DEPARTMENTS);
          }
          if (!g.gt_started_at && daysBetween(fd, t) > 2 && chance(0.45)) {
            g.pathway = chance(0.55) ? 'visitor' : 'not_ready';
            g.pathway_at = at(addDays(fd, Math.min(2, daysBetween(fd, t))), 18);
          }
          if (g.gt_completed_at && chance(0.55)) g.community_joined_at = clampDay(addDays(g.gt_completed_at, 10 + Math.floor(r() * 25)));
        }
      } else if (age >= 2 && chance(0.55)) {
        addF(addDays(sunday, Math.min(age, 2)), chance(0.7) ? 'No answer' : 'Call back later', chance(0.4) ? { next_step_date: addDays(sunday, Math.min(age + 2, 6)) } : {});
      }
      guests.push(g);
    }
  }
  guests.sort((a, b) => b.first_visit.localeCompare(a.first_visit));
  followups.sort((a, b) => b.created_at.localeCompare(a.created_at));
  uploads.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return {
    me: DEMO_TEAM[0],
    profiles: DEMO_TEAM.map((p) => ({ ...p, created_at: at(addDays(firstSunday, -10)) })),
    settings: { ...DEFAULT_SETTINGS },
    guests, followups, uploads,
  };
}

export { iso };
