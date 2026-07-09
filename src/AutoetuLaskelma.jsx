import { useState, useRef, useEffect } from "react";

/* ============================================================
   Verologia – Autoetulaskuri 2026 (v3: roolipohjainen käyttöliittymä)
   Perustuu Verohallinnon päätökseen luontoisetujen laskentaperusteista
   vuodelle 2026 (VH/6275/00.01.00/2025) sekä TVL 64 a §:n mukaiseen
   täyssähköauton 170 €/kk vähennykseen.
   ============================================================ */

const BRAND = "#0D263F";
const NAVY_2 = "#0A1E33";
const ACCENT = "#3C72AB";
const GREEN = "#1F8A5B";
const GREEN_SOFT = "#7FDBBA";
const RED_SOFT = "#C4584A";
const RED_SOFT_DARK = "#E8897E";
const AMBER = "#D4A33C";
const WARM = "#FFFFFF";
const SAND = "#F3F2EC";
const LINE = "#E4E0D6";
const MUTED = "#5A6675";
const HEAD = "'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

/* ---------- Verohallinnon päätös 2026 (17–20 §) ---------- */

const PRICE_DEDUCTION = 3400;
const ACCESSORY_FREE_LIMIT = 1200;

const AGE_GROUPS = {
  A: { percent: 0.015, freeMonthly: 285, freeKm: 0.19, usageMonthly: 105, usageKm: 0.07, label: "Käyttöönotettu 2024–2026" },
  B: { percent: 0.012, freeMonthly: 300, freeKm: 0.20, usageMonthly: 120, usageKm: 0.08, label: "Käyttöönotettu 2021–2023" },
  C: { percent: 0.009, freeMonthly: 315, freeKm: 0.21, usageMonthly: 135, usageKm: 0.09, label: "Käyttöönotettu ennen vuotta 2021" },
};

function getAgeClass(year) {
  if (year >= 2024) return "A";
  if (year >= 2021) return "B";
  return "C";
}

const FUEL_TYPES = {
  ice:  { label: "Bensiini / diesel / hybridi", sub: "Ei alennusta", freeMonthly: 0,   freeKm: 0,    ev170: false },
  phev: { label: "Lataushybridi",               sub: "−60 €/kk *",  freeMonthly: 60,  freeKm: 0.04, ev170: false },
  gas:  { label: "Kaasuauto",                   sub: "−60 €/kk *",  freeMonthly: 60,  freeKm: 0.04, ev170: false },
  ev:   { label: "Täyssähkö",                   sub: "−120 −170 €/kk", freeMonthly: 120, freeKm: 0.08, ev170: true },
};
const EV_TVL64A = 170;

export function computeTaxableValue({ benefitType, ageClass, price, accessories, fuel, useKm, kmPerMonth }) {
  const g = AGE_GROUPS[ageClass];
  const accessoryExtra = Math.max(0, (accessories || 0) - ACCESSORY_FREE_LIMIT);
  const adjustedPrice = Math.max(0, price + accessoryExtra - PRICE_DEDUCTION);
  const baseValue = Math.floor((adjustedPrice * g.percent) / 10) * 10;
  const usageValue = useKm
    ? kmPerMonth * (benefitType === "free" ? g.freeKm : g.usageKm)
    : (benefitType === "free" ? g.freeMonthly : g.usageMonthly);
  const f = FUEL_TYPES[fuel];
  const fuelDiscount = benefitType === "free"
    ? (useKm ? kmPerMonth * f.freeKm : f.freeMonthly)
    : 0;
  const ev170 = f.ev170 ? EV_TVL64A : 0;
  const taxableValue = Math.max(0, baseValue + usageValue - fuelDiscount - ev170);
  return { baseValue, usageValue, fuelDiscount, ev170, taxableValue, accessoryExtra };
}

/* Energiakustannus snt/km (muokattavissa): ice ~6,5 l/100km × 1,85 €/l ≈ 12;
   phev sekakäyttö ≈ 8; kaasu ≈ 7; ev kotilataus ≈ 4 */
const ENERGY_DEFAULTS = { ice: 12, phev: 8, gas: 7, ev: 4 };
const OWN_DEFAULTS = { depPct: 15, interestPct: 4, insurance: 90, maintenance: 60, vehicleTax: 10 };
/* Työnantajan kustannusarvio: leasing/poistot+vakuutus+huolto ≈ 1,9 % hinnasta/kk (+ energia vapaassa edussa) */
const EMPLOYER_COST_PCT = 0.019;

/* ---------- Automallit ja alkaen-suositushinnat (kerätty 7/2026, suuntaa-antavia) ---------- */
const CAR_DB = [
  { b: "Audi", m: "A3", p: 36900, f: "ice" },
  { b: "Audi", m: "Q3", p: 43900, f: "ice" },
  { b: "Audi", m: "Q4 e-tron", p: 55000, f: "ev" },
  { b: "BMW", m: "330e", p: 58900, f: "phev" },
  { b: "BMW", m: "i4", p: 62900, f: "ev" },
  { b: "BMW", m: "iX1", p: 55900, f: "ev" },
  { b: "BMW", m: "X1", p: 47900, f: "ice" },
  { b: "BMW", m: "X3", p: 62900, f: "ice" },
  { b: "BYD", m: "Atto 3", p: 38900, f: "ev" },
  { b: "BYD", m: "Dolphin Surf", p: 24590, f: "ev" },
  { b: "BYD", m: "Seal", p: 49290, f: "ev" },
  { b: "BYD", m: "Seal U", p: 45000, f: "ev" },
  { b: "Cupra", m: "Born", p: 38900, f: "ev" },
  { b: "Cupra", m: "Formentor", p: 37500, f: "ice" },
  { b: "Cupra", m: "Terramar", p: 42900, f: "ice" },
  { b: "Dacia", m: "Duster", p: 24900, f: "ice" },
  { b: "Dacia", m: "Sandero", p: 17900, f: "ice" },
  { b: "Ford", m: "Kuga PHEV", p: 45900, f: "phev" },
  { b: "Ford", m: "Puma", p: 29900, f: "ice" },
  { b: "Hyundai", m: "i20", p: 21900, f: "ice" },
  { b: "Hyundai", m: "Ioniq 5", p: 48900, f: "ev" },
  { b: "Hyundai", m: "Kona Electric", p: 44000, f: "ev" },
  { b: "Hyundai", m: "Kona Hybrid", p: 32900, f: "ice" },
  { b: "Hyundai", m: "Tucson", p: 38000, f: "ice" },
  { b: "Hyundai", m: "Tucson PHEV", p: 45400, f: "phev" },
  { b: "Kia", m: "Ceed", p: 25300, f: "ice" },
  { b: "Kia", m: "EV3", p: 38500, f: "ev" },
  { b: "Kia", m: "EV6", p: 47900, f: "ev" },
  { b: "Kia", m: "Niro EV", p: 39900, f: "ev" },
  { b: "Kia", m: "Niro Hybrid", p: 33900, f: "ice" },
  { b: "Kia", m: "Sportage", p: 42400, f: "ice" },
  { b: "Kia", m: "Stonic", p: 22900, f: "ice" },
  { b: "Mazda", m: "CX-5", p: 39900, f: "ice" },
  { b: "Mazda", m: "CX-60 PHEV", p: 55900, f: "phev" },
  { b: "Mercedes-Benz", m: "C 300 e", p: 62900, f: "phev" },
  { b: "Mercedes-Benz", m: "CLA (sähkö)", p: 49990, f: "ev" },
  { b: "Mercedes-Benz", m: "GLC", p: 65000, f: "ice" },
  { b: "MG", m: "HS PHEV", p: 40000, f: "phev" },
  { b: "MG", m: "MG4", p: 32900, f: "ev" },
  { b: "MG", m: "ZS Hybrid+", p: 27000, f: "ice" },
  { b: "Mitsubishi", m: "Outlander PHEV", p: 51900, f: "phev" },
  { b: "Nissan", m: "Ariya", p: 44900, f: "ev" },
  { b: "Nissan", m: "Juke", p: 27900, f: "ice" },
  { b: "Nissan", m: "Qashqai", p: 33800, f: "ice" },
  { b: "Nissan", m: "X-Trail", p: 43900, f: "ice" },
  { b: "Opel", m: "Astra", p: 30900, f: "ice" },
  { b: "Opel", m: "Corsa", p: 23900, f: "ice" },
  { b: "Peugeot", m: "208", p: 24900, f: "ice" },
  { b: "Peugeot", m: "2008", p: 29900, f: "ice" },
  { b: "Peugeot", m: "3008", p: 39900, f: "ice" },
  { b: "Polestar", m: "Polestar 2", p: 47900, f: "ev" },
  { b: "Polestar", m: "Polestar 4", p: 66900, f: "ev" },
  { b: "Renault", m: "Clio", p: 23900, f: "ice" },
  { b: "Renault", m: "Megane E-Tech", p: 38900, f: "ev" },
  { b: "Renault", m: "Scenic E-Tech", p: 42900, f: "ev" },
  { b: "Skoda", m: "Elroq", p: 40000, f: "ev" },
  { b: "Skoda", m: "Enyaq", p: 45880, f: "ev" },
  { b: "Skoda", m: "Fabia", p: 22900, f: "ice" },
  { b: "Skoda", m: "Kamiq", p: 26000, f: "ice" },
  { b: "Skoda", m: "Karoq", p: 33500, f: "ice" },
  { b: "Skoda", m: "Kodiaq", p: 47400, f: "ice" },
  { b: "Skoda", m: "Octavia", p: 30100, f: "ice" },
  { b: "Skoda", m: "Octavia iV", p: 39300, f: "phev" },
  { b: "Skoda", m: "Scala", p: 25500, f: "ice" },
  { b: "Skoda", m: "Superb", p: 41900, f: "ice" },
  { b: "Suzuki", m: "Vitara", p: 29900, f: "ice" },
  { b: "Tesla", m: "Model 3", p: 36990, f: "ev" },
  { b: "Tesla", m: "Model Y", p: 44990, f: "ev" },
  { b: "Toyota", m: "bZ4X", p: 42900, f: "ev" },
  { b: "Toyota", m: "C-HR", p: 34800, f: "ice" },
  { b: "Toyota", m: "C-HR PHEV", p: 43500, f: "phev" },
  { b: "Toyota", m: "Corolla", p: 31500, f: "ice" },
  { b: "Toyota", m: "Corolla Cross", p: 39800, f: "ice" },
  { b: "Toyota", m: "RAV4 Hybrid", p: 41500, f: "ice" },
  { b: "Toyota", m: "RAV4 PHEV", p: 51000, f: "phev" },
  { b: "Toyota", m: "Yaris", p: 26900, f: "ice" },
  { b: "Toyota", m: "Yaris Cross", p: 29900, f: "ice" },
  { b: "Volkswagen", m: "Golf", p: 31900, f: "ice" },
  { b: "Volkswagen", m: "ID.3", p: 39900, f: "ev" },
  { b: "Volkswagen", m: "ID.4", p: 45590, f: "ev" },
  { b: "Volkswagen", m: "ID.7", p: 53900, f: "ev" },
  { b: "Volkswagen", m: "Passat Variant", p: 45500, f: "ice" },
  { b: "Volkswagen", m: "Polo", p: 24500, f: "ice" },
  { b: "Volkswagen", m: "T-Cross", p: 27500, f: "ice" },
  { b: "Volkswagen", m: "Taigo", p: 28500, f: "ice" },
  { b: "Volkswagen", m: "T-Roc", p: 33900, f: "ice" },
  { b: "Volkswagen", m: "Tiguan", p: 39400, f: "ice" },
  { b: "Volkswagen", m: "Tiguan eHybrid", p: 46000, f: "phev" },
  { b: "Volvo", m: "EX30", p: 35300, f: "ev" },
  { b: "Volvo", m: "EX40", p: 49300, f: "ev" },
  { b: "Volvo", m: "V60 PHEV", p: 57600, f: "phev" },
  { b: "Volvo", m: "V90", p: 62000, f: "ice" },
  { b: "Volvo", m: "XC40", p: 42900, f: "ice" },
  { b: "Volvo", m: "XC60 PHEV", p: 62900, f: "phev" },
  { b: "Volvo", m: "XC90", p: 89000, f: "ice" },
];
const CAR_BRANDS = [...new Set(CAR_DB.map((c) => c.b))];

const SALARY_EXAMPLES = [
  { label: "2 500 €/kk", gross: 2500 },
  { label: "3 000 €/kk", gross: 3000 },
  { label: "3 500 €/kk", gross: 3500 },
  { label: "4 000 €/kk", gross: 4000 },
  { label: "4 500 €/kk", gross: 4500 },
  { label: "5 000 €/kk", gross: 5000 },
];
const SALARY_MAX = 20000;

function getMarginalTax(salary) {
  const points = [
    [2500, 0.30], [3000, 0.35], [3500, 0.40],
    [4000, 0.43], [4500, 0.45], [5000, 0.47],
    [7000, 0.50], [10000, 0.53], [15000, 0.55],
  ];
  if (salary <= points[0][0]) return points[0][1];
  if (salary >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    if (salary >= x1 && salary <= x2) {
      const t = (salary - x1) / (x2 - x1);
      return y1 + t * (y2 - y1);
    }
  }
  return points[points.length - 1][1];
}

const SIVUKULUT_RATE = 0.205;
const PRICE_MIN = 15000;
const PRICE_MAX = 150000;
const PRICE_DEFAULT = 45000;
const YEAR_MIN = 2008;
const YEAR_MAX = 2026;

function fmt(n) {
  return n.toLocaleString("fi-FI", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmt0(n) {
  return n.toLocaleString("fi-FI", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const sliderCSS = `
.vl-range{ -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:999px;
  background:${LINE}; outline:none; }
.vl-range::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:22px; height:22px;
  border-radius:50%; background:${ACCENT}; cursor:pointer; border:3px solid #fff;
  box-shadow:0 2px 6px rgba(13,38,63,.25); }
.vl-range::-moz-range-thumb{ width:22px; height:22px; border-radius:50%; background:${ACCENT};
  cursor:pointer; border:3px solid #fff; box-shadow:0 2px 6px rgba(13,38,63,.25); }
.vl-select{ padding:10px 12px; font-family:${BODY}; font-size:13.5px; font-weight:600; color:${BRAND};
  background:#fff; border:1.5px solid ${LINE}; border-radius:10px; outline:none; width:100%; cursor:pointer; }
`;

const labelStyle = { fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED };
const numInput = { padding: "6px 10px", fontFamily: HEAD, fontSize: 14, fontWeight: 700, color: BRAND, background: "#fff", border: `1.5px solid ${LINE}`, borderRadius: 8, textAlign: "right", outline: "none" };

function Accordion({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, marginBottom: 18, background: "#fff" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", padding: "13px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}>
        <span style={labelStyle}>{title}</span>
        <span style={{ color: ACCENT, fontFamily: HEAD, fontWeight: 800, fontSize: 18, lineHeight: 1 }}>{open ? "−" : "+"}</span>
      </button>
      {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
    </div>
  );
}

function AnimBar({ value, max, color, label, delay = 0 }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: BODY, color: MUTED, marginBottom: 5, fontWeight: 500 }}>
        <span>{label}</span>
        <span style={{ fontFamily: HEAD, fontWeight: 700, color }}>{fmt(value)} €</span>
      </div>
      <div style={{ height: 20, borderRadius: 6, background: "rgba(13,38,63,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 6, background: color, width: `${pct}%`, transition: `width 0.8s cubic-bezier(0.4,0,0.2,1) ${delay}s` }} />
      </div>
    </div>
  );
}

function ChoiceBtn({ active, onClick, children, two }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: two ? "12px 8px" : "10px 6px", fontFamily: BODY, fontSize: 13, fontWeight: 600,
      border: `2px solid ${active ? ACCENT : LINE}`, borderRadius: 10,
      background: active ? ACCENT : "#fff", color: active ? "#fff" : BRAND,
      cursor: "pointer", lineHeight: 1.3, transition: "all 0.2s",
    }}>{children}</button>
  );
}

function BreakdownRow({ label, value, negative }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontFamily: BODY, fontSize: 13, color: "#14202E" }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ fontFamily: HEAD, fontWeight: 700, color: negative ? GREEN : BRAND }}>
        {value >= 0 ? "" : "−"}{fmt(Math.abs(value))} €
      </span>
    </div>
  );
}

export default function AutoetuLaskuri2026() {
  const [role, setRole] = useState("employee"); // "employee" | "employer"
  const [benefitType, setBenefitType] = useState("free");
  const [carYear, setCarYear] = useState(2026);
  const [carPrice, setCarPrice] = useState(PRICE_DEFAULT);
  const [accessories, setAccessories] = useState(0);
  const [fuelType, setFuelType] = useState("ice");
  const [selBrand, setSelBrand] = useState("");
  const [selModel, setSelModel] = useState("");
  const [useKm, setUseKm] = useState(false);
  const [kmAmount, setKmAmount] = useState(1000);
  const [kmPeriod, setKmPeriod] = useState("month");
  const [salaryGross, setSalaryGross] = useState(3500);
  const [employees, setEmployees] = useState(30);
  const [kmYear, setKmYear] = useState(18000);
  const [energyRate, setEnergyRate] = useState(null);          // null = oletus käyttövoiman mukaan
  const [salaryModel, setSalaryModel] = useState("total");
  const [employerCostManual, setEmployerCostManual] = useState(null); // null = arvio hinnasta
  const [sacrificeManual, setSacrificeManual] = useState(null);       // null = sama kuin työnantajan kustannus
  const [ownDep, setOwnDep] = useState(OWN_DEFAULTS.depPct);
  const [ownInterest, setOwnInterest] = useState(OWN_DEFAULTS.interestPct);
  const [ownIns, setOwnIns] = useState(OWN_DEFAULTS.insurance);
  const [ownMaint, setOwnMaint] = useState(OWN_DEFAULTS.maintenance);
  const [ownTax, setOwnTax] = useState(OWN_DEFAULTS.vehicleTax);

  const ageClass = getAgeClass(carYear);
  const marginalTax = getMarginalTax(salaryGross);
  const kmPerMonth = kmPeriod === "year" ? kmAmount / 12 : kmAmount;
  const kmPerYearLog = kmPeriod === "year" ? kmAmount : kmAmount * 12;

  const clampNum = (raw, min, max, setter) => {
    if (raw === "") { setter(0); return; }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    setter(Math.min(max, Math.max(min, Math.round(num))));
  };
  const autoNum = (raw, max, setter) => {
    if (raw === "") { setter(null); return; } // tyhjä = palaa automaattiseen arvioon
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    setter(Math.min(max, Math.max(0, Math.round(num))));
  };

  const pickModel = (brand, model) => {
    setSelBrand(brand);
    setSelModel(model);
    const car = CAR_DB.find((c) => c.b === brand && c.m === model);
    if (car) {
      setCarPrice(car.p);
      setFuelType(car.f);
      setCarYear(2026);
    }
  };

  /* ---------- Laskenta ---------- */
  const calc = computeTaxableValue({ benefitType, ageClass, price: carPrice, accessories, fuel: fuelType, useKm, kmPerMonth });

  const energySntKm = energyRate === null ? ENERGY_DEFAULTS[fuelType] : energyRate;
  const energyMonthly = (kmYear / 12) * (energySntKm / 100);

  // Työnantajan kustannusarvio suoraan auton hinnasta (muokattavissa)
  const employerCostAuto = Math.round((carPrice * EMPLOYER_COST_PCT + (benefitType === "free" ? energyMonthly : 0)) / 10) * 10;
  const employerCost = employerCostManual === null ? employerCostAuto : employerCostManual;
  const sacrifice = sacrificeManual === null ? employerCost : sacrificeManual;

  // Työnantajan vertailu (autoetu vs. palkankorotus)
  const employerCostBenefit = employerCost + calc.taxableValue * SIVUKULUT_RATE;
  const employeeNetBenefit = employerCost - calc.taxableValue * marginalTax;
  const employerCostSalary = employerCost * (1 + SIVUKULUT_RATE);
  const employeeNetSalary = employerCost * (1 - marginalTax);
  const employerSavingsMonth = employerCostSalary - employerCostBenefit;
  const employerSavingsYear = employerSavingsMonth * 12;
  const totalEmployerSavingsYear = employerSavingsYear * employees;
  const maxBar = Math.max(employerCostSalary, employerCostBenefit, employerCost);

  // Työntekijän kannattavuus (autoetu vs. oma auto)
  const benefitTax = calc.taxableValue * marginalTax;
  const netSalaryLoss = salaryModel === "total" ? sacrifice * (1 - marginalTax) : 0;
  const benefitEnergy = benefitType === "usage" ? energyMonthly : 0;
  const benefitTotal = benefitTax + netSalaryLoss + benefitEnergy;
  const ownDepM = (carPrice * ownDep) / 100 / 12;
  const ownIntM = (carPrice * 0.5 * ownInterest) / 100 / 12;
  const ownFixed = ownDepM + ownIntM + ownIns + ownMaint + ownTax;
  const ownTotal = ownFixed + energyMonthly;
  const advantage = ownTotal - benefitTotal;
  const breakEvenKm = benefitType === "free" && energySntKm > 0
    ? ((benefitTax + netSalaryLoss - ownFixed) / (energySntKm / 100)) * 12
    : null;

  const card = { background: "#fff", borderRadius: 12, padding: 18, border: `1px solid ${LINE}`, boxShadow: "0 10px 30px -16px rgba(28,40,30,.22)" };

  const rootRef = useRef(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => { setNarrow(entries[0].contentRect.width < 560); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const cols2 = narrow ? "1fr" : "minmax(0,1fr) minmax(0,1fr)";
  const ctr = narrow ? "center" : "left";

  const modelsForBrand = CAR_DB.filter((c) => c.b === selBrand);

  return (
    <div ref={rootRef} style={{ minHeight: "100vh", background: WARM, fontFamily: BODY, color: "#14202E" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{sliderCSS}</style>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${NAVY_2} 100%)`, color: "#fff", padding: "34px 20px 28px", position: "relative", overflow: "hidden", textAlign: "center" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(60,114,171,0.22)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Verologia · Autoetu 2026</div>
          <h1 style={{ fontFamily: HEAD, fontSize: 28, fontWeight: 800, margin: "10px 0 0", lineHeight: 1.05, letterSpacing: "-.028em", color: "#fff" }}>Autoetulaskuri</h1>
          <p style={{ fontFamily: BODY, fontSize: 14.5, color: "rgba(255,255,255,0.72)", margin: "10px auto 0", lineHeight: 1.55, maxWidth: 540 }}>Verotusarvo Verohallinnon 2026 päätöksen mukaan – ja rehellinen vastaus siihen, kannattaako autoetu.</p>
        </div>
      </div>

      <div style={{ padding: "20px 16px 100px", maxWidth: 720, margin: "0 auto" }}>

        {/* Role tabs */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <ChoiceBtn two active={role === "employee"} onClick={() => setRole("employee")}>
              Työntekijälle<div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>Kannattaako autoetu ottaa?</div>
            </ChoiceBtn>
            <ChoiceBtn two active={role === "employer"} onClick={() => setRole("employer")}>
              Työnantajalle<div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>Autoetu vai palkankorotus?</div>
            </ChoiceBtn>
          </div>
        </div>

        {/* Car picker */}
        <div style={{ ...card, marginBottom: 18 }}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Auto</div>
          <div style={{ display: "grid", gridTemplateColumns: cols2, gap: 8 }}>
            <select className="vl-select" value={selBrand} onChange={(e) => { setSelBrand(e.target.value); setSelModel(""); }}>
              <option value="">Merkki…</option>
              {CAR_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className="vl-select" value={selModel} disabled={!selBrand} onChange={(e) => pickModel(selBrand, e.target.value)}>
              <option value="">Malli…</option>
              {modelsForBrand.map((c) => <option key={c.m} value={c.m}>{c.m} – alk. {fmt0(c.p)} €</option>)}
            </select>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontFamily: BODY, fontSize: 12, color: MUTED, fontWeight: 600 }}>Uushankintahinta (suositushinta)</span>
              <input type="number" max={PRICE_MAX} step={500} value={carPrice === 0 ? "" : carPrice} onChange={(e) => clampNum(e.target.value, 0, PRICE_MAX, setCarPrice)} style={{ ...numInput, width: 110 }} />
            </div>
            <input className="vl-range" type="range" min={PRICE_MIN} max={PRICE_MAX} step={500} value={carPrice} onChange={(e) => { setCarPrice(Number(e.target.value)); setSelModel(""); }} />
          </div>
          {selModel && (
            <div style={{ fontFamily: BODY, fontSize: 11.5, color: MUTED, marginTop: 8, lineHeight: 1.5 }}>
              Hinta on alkaen-suositushinta (7/2026). Verotusarvo lasketaan aina kyseisen yksilön todellisesta uushankintahinnasta – tarkenna tarvittaessa.
            </div>
          )}
        </div>

        {/* Benefit type */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Autoetutyyppi</div>
          <div style={{ display: "flex", gap: 8 }}>
            <ChoiceBtn two active={benefitType === "free"} onClick={() => setBenefitType("free")}>
              Vapaa autoetu<div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>Työnantaja maksaa kaiken</div>
            </ChoiceBtn>
            <ChoiceBtn two active={benefitType === "usage"} onClick={() => setBenefitType("usage")}>
              Käyttöetu<div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>Työntekijä maksaa vähintään käyttövoiman</div>
            </ChoiceBtn>
          </div>
        </div>

        {/* Fuel type */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Käyttövoima</div>
          <div style={{ display: "flex", gap: 6, flexWrap: narrow ? "wrap" : "nowrap" }}>
            {Object.entries(FUEL_TYPES).map(([id, f]) => (
              <ChoiceBtn key={id} active={fuelType === id} onClick={() => setFuelType(id)}>
                {f.label}<div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>{f.sub}</div>
              </ChoiceBtn>
            ))}
          </div>
          {(fuelType === "phev" || fuelType === "gas") && benefitType === "usage" && (
            <div style={{ fontFamily: BODY, fontSize: 11.5, color: AMBER, marginTop: 6, fontWeight: 600 }}>
              Huom: −60 €/kk alennus koskee vain vapaata autoetua.
            </div>
          )}
        </div>

        {/* Lisäasetukset: auton lisätiedot */}
        <Accordion title="Lisäasetukset: käyttöönottovuosi, lisävarusteet, km-arvostus">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: BODY, fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 4 }}>Käyttöönottovuosi</div>
              <select className="vl-select" style={{ maxWidth: 120 }} value={carYear} onChange={(e) => setCarYear(Number(e.target.value))}>
                {Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MAX - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div style={{ fontFamily: BODY, fontSize: 12, color: MUTED, alignSelf: "flex-end", paddingBottom: 10 }}>
              Ikäryhmä <strong style={{ color: BRAND }}>{ageClass}</strong> · {AGE_GROUPS[ageClass].label} · perusarvo {(AGE_GROUPS[ageClass].percent * 100).toFixed(1).replace(".", ",")} %
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontFamily: BODY, fontSize: 11, color: MUTED, fontWeight: 600 }}>Lisävarusteiden arvo (huomioidaan 1 200 € ylittävältä osalta)</span>
            <input type="number" max={50000} step={100} value={accessories === 0 ? "" : accessories} placeholder="0" onChange={(e) => clampNum(e.target.value, 0, 50000, setAccessories)} style={{ ...numInput, width: 100 }} />
          </div>
          {calc.accessoryExtra > 0 && (
            <div style={{ fontFamily: BODY, fontSize: 11.5, color: MUTED, marginBottom: 10 }}>Hintaan lisätään {fmt0(calc.accessoryExtra)} €.</div>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 10 }}>
            <input type="checkbox" checked={useKm} onChange={(e) => setUseKm(e.target.checked)} style={{ width: 18, height: 18, accentColor: ACCENT }} />
            <span style={{ fontFamily: BODY, fontSize: 13, fontWeight: 600, color: BRAND }}>Laske arvo todellisten yksityisajojen mukaan (vaatii ajopäiväkirjan)</span>
          </label>
          {useKm && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input type="number" min={0} max={200000} step={100} value={kmAmount === 0 ? "" : kmAmount} onChange={(e) => clampNum(e.target.value, 0, 200000, setKmAmount)} style={{ ...numInput, width: 110 }} />
                <select className="vl-select" style={{ maxWidth: 140 }} value={kmPeriod} onChange={(e) => setKmPeriod(e.target.value)}>
                  <option value="month">km / kuukausi</option>
                  <option value="year">km / vuosi</option>
                </select>
                <span style={{ fontFamily: BODY, fontSize: 12, color: MUTED }}>
                  {benefitType === "free" ? (AGE_GROUPS[ageClass].freeKm * 100).toFixed(0) : (AGE_GROUPS[ageClass].usageKm * 100).toFixed(0)} snt/km (ikäryhmä {ageClass})
                </span>
              </div>
              {kmPerYearLog > 18000 && (
                <div style={{ fontFamily: BODY, fontSize: 11.5, color: AMBER, marginTop: 6, fontWeight: 600 }}>
                  Yli 18 000 yksityisajokilometrillä/v Verohallinto voi korottaa arvon kaavamaiseen kuukausiarvoon.
                </div>
              )}
            </div>
          )}
        </Accordion>

        {/* Tax value */}
        <div style={{ ...card, border: `2px solid ${ACCENT}`, boxShadow: "0 10px 30px -14px rgba(60,114,171,0.4)", marginBottom: 18 }}>
          <div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: ACCENT, marginBottom: 14 }}>Autoedun verotusarvo / kk</div>
          <BreakdownRow label={`Perusarvo ${(AGE_GROUPS[ageClass].percent * 100).toFixed(1).replace(".", ",")} % × (hinta ${calc.accessoryExtra > 0 ? "+ lisävarusteet " : ""}− 3 400 €), pyöristetty`} value={calc.baseValue} />
          <BreakdownRow
            label={useKm
              ? `Käyttökustannukset ${fmt0(kmPerMonth)} km/kk kilometriarvolla`
              : `Käyttökustannukset (kaavamainen, ${benefitType === "free" ? "vapaa etu" : "käyttöetu"})`}
            value={calc.usageValue}
          />
          {calc.fuelDiscount > 0 && (
            <BreakdownRow label={`Käyttövoima-alennus (${FUEL_TYPES[fuelType].label.toLowerCase()})`} value={-calc.fuelDiscount} negative />
          )}
          {calc.ev170 > 0 && (
            <BreakdownRow label="Täyssähköauton vähennys (TVL 64 a §)" value={-calc.ev170} negative />
          )}
          <div style={{ marginTop: 10, paddingTop: 12, borderTop: `2px solid ${LINE}`, display: "flex", justifyContent: "space-between", fontFamily: BODY, fontSize: 15, fontWeight: 600, color: BRAND }}>
            <span>Verotusarvo yhteensä</span>
            <span style={{ fontFamily: HEAD, fontWeight: 800, color: ACCENT, fontSize: 22, letterSpacing: "-.02em" }}>{fmt(calc.taxableValue)} €</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
            Tämä summa lisätään kuukausipalkkaasi verotettavana tulona ({fmt0(calc.taxableValue * 12)} €/v). Työnantajan sivukulut lasketaan tästä, ei auton todellisesta kustannuksesta.
          </div>
        </div>

        {/* Salary – shared */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <div style={labelStyle}>{role === "employee" ? "Palkkasi" : "Työntekijän palkka"} (marginaalivero {Math.round(marginalTax * 100)} %)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="number" max={SALARY_MAX} step={100} value={salaryGross === 0 ? "" : salaryGross} onChange={(e) => clampNum(e.target.value, 0, SALARY_MAX, setSalaryGross)} style={{ ...numInput, width: 100 }} />
              <span style={{ fontFamily: BODY, fontSize: 11, color: MUTED }}>€/kk</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SALARY_EXAMPLES.map((s) => (
              <button key={s.gross} onClick={() => setSalaryGross(s.gross)} style={{
                padding: "9px 13px", fontFamily: BODY, fontSize: 13, fontWeight: 600,
                border: `1.5px solid ${s.gross === salaryGross ? ACCENT : LINE}`, borderRadius: 999,
                background: s.gross === salaryGross ? ACCENT : "#fff", color: s.gross === salaryGross ? "#fff" : BRAND,
                cursor: "pointer", transition: "all 0.2s",
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        {/* ============ TYÖNTEKIJÄLLE ============ */}
        {role === "employee" && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ ...labelStyle, marginBottom: 10 }}>Miten autoetu annetaan?</div>
              <div style={{ display: "flex", gap: 8 }}>
                <ChoiceBtn two active={salaryModel === "total"} onClick={() => setSalaryModel("total")}>
                  Osana kokonaispalkkaa<div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>Bruttopalkkaa alennetaan auton kustannuksella</div>
                </ChoiceBtn>
                <ChoiceBtn two active={salaryModel === "ontop"} onClick={() => setSalaryModel("ontop")}>
                  Palkan päälle<div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>Palkka ei muutu, etu tulee lisänä</div>
                </ChoiceBtn>
              </div>
              {salaryModel === "total" && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: BODY, fontSize: 12, color: MUTED }}>Bruttopalkan alennus:</span>
                  <input type="number" max={3000} step={50} value={sacrifice} onChange={(e) => autoNum(e.target.value, 3000, setSacrificeManual)} style={{ ...numInput, width: 90 }} />
                  <span style={{ fontFamily: BODY, fontSize: 12, color: MUTED }}>€/kk {sacrificeManual === null && "(arvio auton kustannuksesta – tyhjennä palataksesi arvioon)"}</span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={labelStyle}>Paljonko ajat yksityisajoa / vuosi?</div>
                <input type="number" max={60000} step={1000} value={kmYear === 0 ? "" : kmYear} onChange={(e) => clampNum(e.target.value, 0, 60000, setKmYear)} style={{ ...numInput, width: 100 }} />
              </div>
              <input className="vl-range" type="range" min={2000} max={50000} step={1000} value={kmYear} onChange={(e) => setKmYear(Number(e.target.value))} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(13,38,63,0.4)", marginTop: 6 }}>
                <span>2 000 km</span><span>18 000 km</span><span>34 000 km</span><span>50 000 km</span>
              </div>
            </div>

            {/* Tulos */}
            <div style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${NAVY_2} 100%)`, borderRadius: 12, padding: 22, color: "#fff", marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>
                {advantage >= 0 ? "Autoetu kannattaa sinulle" : "Autoetu ei kannata sinulle"}
              </div>
              <div style={{ fontFamily: HEAD, fontSize: 34, fontWeight: 800, letterSpacing: "-.02em", color: advantage >= 0 ? GREEN_SOFT : RED_SOFT_DARK }}>
                {advantage >= 0 ? "+" : ""}{fmt(advantage)} €/kk
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.72)", marginTop: 6 }}>
                eli {advantage >= 0 ? "+" : ""}{fmt0(advantage * 12)} € vuodessa verrattuna vastaavan auton omistamiseen
              </div>
              {benefitType === "free" && breakEvenKm !== null && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", marginTop: 14, paddingTop: 14, fontSize: 13.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.6 }}>
                  {breakEvenKm <= 0
                    ? "Tällä autolla ja palkkamallilla vapaa autoetu kannattaa ajomäärästä riippumatta."
                    : <>Vapaa autoetu kannattaa, kun ajat yli <strong style={{ color: GREEN_SOFT }}>{fmt0(Math.max(0, breakEvenKm))} km vuodessa</strong> – polttoaine sisältyy kiinteään verotusarvoon.</>}
                </div>
              )}
              {benefitType === "usage" && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", marginTop: 14, paddingTop: 14, fontSize: 13.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.6 }}>
                  Käyttöedussa maksat energian itse, joten kannattavuus ei juuri riipu ajomäärästä.
                </div>
              )}
            </div>

            {/* Vertailukortit */}
            <div style={{ display: "grid", gridTemplateColumns: cols2, textAlign: ctr, gap: 12, marginBottom: 16 }}>
              <div style={{ ...card, background: SAND, boxShadow: "none" }}>
                <div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginBottom: 12 }}>Oma auto</div>
                <BreakdownRow label={`Arvonalenema (${ownDep} %/v)`} value={ownDepM} />
                <BreakdownRow label={`Korko (${ownInterest} %/v)`} value={ownIntM} />
                <BreakdownRow label="Vakuutus, huolto, renkaat, vero" value={ownIns + ownMaint + ownTax} />
                <BreakdownRow label={`Energia ${fmt0(kmYear)} km/v`} value={energyMonthly} />
                <div style={{ marginTop: 8, paddingTop: 10, borderTop: `2px solid ${LINE}`, display: "flex", justifyContent: "space-between", fontFamily: BODY, fontSize: 14, fontWeight: 600, color: BRAND }}>
                  <span>Yhteensä /kk</span>
                  <span style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 20 }}>{fmt(ownTotal)} €</span>
                </div>
              </div>
              <div style={{ ...card, border: `2px solid ${ACCENT}`, boxShadow: "0 10px 30px -14px rgba(60,114,171,0.4)" }}>
                <div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>Autoetu</div>
                <BreakdownRow label={`Vero verotusarvosta (${Math.round(marginalTax * 100)} % × ${fmt0(calc.taxableValue)} €)`} value={benefitTax} />
                {netSalaryLoss > 0 && <BreakdownRow label={`Menetetty nettopalkka (${fmt0(sacrifice)} € brutto)`} value={netSalaryLoss} />}
                {benefitEnergy > 0 && <BreakdownRow label="Itse maksettu energia (käyttöetu)" value={benefitEnergy} />}
                <div style={{ marginTop: 8, paddingTop: 10, borderTop: `2px solid ${LINE}`, display: "flex", justifyContent: "space-between", fontFamily: BODY, fontSize: 14, fontWeight: 600, color: BRAND }}>
                  <span>Yhteensä /kk</span>
                  <span style={{ fontFamily: HEAD, fontWeight: 800, fontSize: 20, color: ACCENT }}>{fmt(benefitTotal)} €</span>
                </div>
              </div>
            </div>

            <Accordion title="Lisäasetukset: energiakustannus ja oman auton kulut">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <span style={{ fontFamily: BODY, fontSize: 12, color: MUTED }}>Energiakustannus:</span>
                <input type="number" max={60} step={1} value={energySntKm === 0 ? "" : energySntKm} onChange={(e) => autoNum(e.target.value, 60, setEnergyRate)} style={{ ...numInput, width: 70 }} />
                <span style={{ fontFamily: BODY, fontSize: 12, color: MUTED }}>snt/km {energyRate === null && "(oletus käyttövoiman mukaan)"}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr 1fr" : "repeat(5, 1fr)", gap: 10 }}>
                {[
                  { label: "Arvonalenema %/v", val: ownDep, set: setOwnDep, max: 40 },
                  { label: "Korko %/v", val: ownInterest, set: setOwnInterest, max: 15 },
                  { label: "Vakuutus €/kk", val: ownIns, set: setOwnIns, max: 400 },
                  { label: "Huolto+renkaat €/kk", val: ownMaint, set: setOwnMaint, max: 500 },
                  { label: "Ajoneuvovero €/kk", val: ownTax, set: setOwnTax, max: 100 },
                ].map((f) => (
                  <div key={f.label}>
                    <div style={{ fontFamily: BODY, fontSize: 10.5, color: MUTED, marginBottom: 4, fontWeight: 600 }}>{f.label}</div>
                    <input type="number" max={f.max} value={f.val === 0 ? "" : f.val} onChange={(e) => clampNum(e.target.value, 0, f.max, f.set)} style={{ ...numInput, width: "100%", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: BODY, fontSize: 11.5, color: MUTED, marginTop: 10, lineHeight: 1.5 }}>
                Korko lasketaan keskimääräiselle sidotulle pääomalle (50 % hinnasta). Oletukset ovat tyypillisiä keskiarvoja.
              </div>
            </Accordion>

            <div style={{ background: "rgba(60,114,171,0.06)", borderRadius: 12, padding: "14px 16px", border: `1px solid ${ACCENT}33`, marginBottom: 16, fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
              Vertailu olettaa, että hankkisit muuten vastaavan auton itse. Autoetuun sisältyy lisäksi arvoa, jota luvut eivät näytä: ei jälleenmyynti-, korjaus- eikä korkoriskiä, ei pääomaa kiinni autossa. Jos et muuten hankkisi autoa lainkaan tai ajaisit halvemmalla autolla, vertaa lukuja siihen vaihtoehtoon.
            </div>
          </>
        )}

        {/* ============ TYÖNANTAJALLE ============ */}
        {role === "employer" && (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
                <div style={labelStyle}>Auton kustannus työnantajalle / kk</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" max={5000} step={50} value={employerCost} onChange={(e) => autoNum(e.target.value, 5000, setEmployerCostManual)} style={{ ...numInput, width: 100 }} />
                  <span style={{ fontFamily: BODY, fontSize: 11, color: MUTED }}>€/kk</span>
                </div>
              </div>
              <div style={{ fontFamily: BODY, fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
                {employerCostManual === null
                  ? "Arvio auton hinnasta (leasing/poistot, vakuutus, huolto" + (benefitType === "free" ? ", energia" : "") + "). Muokkaa tarvittaessa – tyhjennä palataksesi arvioon."
                  : "Oma arvo käytössä – tyhjennä kenttä palataksesi automaattiseen arvioon."}
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={labelStyle}>Autoedun saavien määrä</div>
                <input type="number" min={1} max={1000} value={employees} onChange={(e) => clampNum(e.target.value, 1, 1000, setEmployees)} style={{ ...numInput, width: 90 }} />
              </div>
              <input className="vl-range" type="range" min={1} max={1000} value={employees} onChange={(e) => setEmployees(Number(e.target.value))} />
            </div>

            {/* Vuosisäästö skaalattuna – tärkein tulos ensin */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ ...labelStyle, textAlign: "center", marginBottom: 14 }}>Skaalattu: {employees} työntekijää / vuosi</div>
              <div style={{ display: "grid", gridTemplateColumns: cols2, gap: 12, textAlign: "center", marginBottom: 12 }}>
                <div style={{ background: SAND, borderRadius: 10, padding: "14px 10px" }}>
                  <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Palkankorotus yhteensä</div>
                  <div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: RED_SOFT }}>{fmt(employerCostSalary * 12 * employees)} €</div>
                </div>
                <div style={{ background: "#E3F2EA", borderRadius: 10, padding: "14px 10px" }}>
                  <div style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Autoetu yhteensä</div>
                  <div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: GREEN }}>{fmt(employerCostBenefit * 12 * employees)} €</div>
                </div>
              </div>
              <div style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${NAVY_2} 100%)`, borderRadius: 10, padding: "16px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>Työnantajan kokonaissäästö vuodessa</div>
                <div style={{ fontFamily: HEAD, fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", color: totalEmployerSavingsYear >= 0 ? GREEN_SOFT : RED_SOFT_DARK }}>{fmt(totalEmployerSavingsYear)} €</div>
              </div>
            </div>

            {/* Comparison cards */}
            <div style={{ display: "grid", gridTemplateColumns: cols2, textAlign: ctr, gap: 12, marginBottom: 16 }}>
              <div style={{ ...card, background: SAND, boxShadow: "none" }}>
                <div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginBottom: 12 }}>Palkankorotus</div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Työnantaja maksaa /kk</div>
                <div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, color: "#14202E", letterSpacing: "-.02em", marginBottom: 12 }}>{fmt(employerCostSalary)} €</div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Työntekijä saa käteen /kk</div>
                <div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, color: BRAND, letterSpacing: "-.02em" }}>{fmt(employeeNetSalary)} €</div>
              </div>
              <div style={{ ...card, border: `2px solid ${ACCENT}`, boxShadow: "0 10px 30px -14px rgba(60,114,171,0.4)" }}>
                <div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>Autoetu ✓</div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Työnantaja maksaa /kk</div>
                <div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, color: ACCENT, letterSpacing: "-.02em", marginBottom: 12 }}>{fmt(employerCostBenefit)} €</div>
                <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Työntekijän nettohyöty /kk</div>
                <div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, color: BRAND, letterSpacing: "-.02em" }}>{fmt(employeeNetBenefit)} €</div>
              </div>
            </div>

            {/* Bars */}
            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ ...labelStyle, marginBottom: 14 }}>Työnantajan kustannus / kuukausi</div>
              <AnimBar value={employerCostSalary} max={maxBar} color={RED_SOFT} label="Palkankorotus (brutto + sivukulut 20,5 %)" delay={0.1} />
              <AnimBar value={employerCostBenefit} max={maxBar} color={GREEN} label="Autoetu (sivukulut vain verotusarvosta)" delay={0.2} />
              <div style={{ ...labelStyle, margin: "14px 0" }}>Työntekijän nettohyöty / kuukausi</div>
              <AnimBar value={Math.max(0, employeeNetSalary)} max={employerCost || 1} color={RED_SOFT} label={`Palkankorotus (marginaalivero ${Math.round(marginalTax * 100)} %)`} delay={0.3} />
              <AnimBar value={Math.max(0, employeeNetBenefit)} max={employerCost || 1} color={GREEN} label="Autoetu (vero vain verotusarvosta)" delay={0.4} />
            </div>

            {/* Summary */}
            <div style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${NAVY_2} 100%)`, borderRadius: 12, padding: 22, color: "#fff", marginBottom: 16 }}>
              <div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 14 }}>Yhteenveto</div>
              <div style={{ display: "grid", gridTemplateColumns: cols2, textAlign: ctr, gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>Työnantaja säästää /kk</div>
                  <div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: employerSavingsMonth >= 0 ? GREEN_SOFT : RED_SOFT_DARK }}>{fmt(employerSavingsMonth)} €</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>Työntekijä hyötyy /kk</div>
                  <div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: employeeNetBenefit - employeeNetSalary >= 0 ? GREEN_SOFT : RED_SOFT_DARK }}>{employeeNetBenefit - employeeNetSalary >= 0 ? "+" : ""}{fmt(employeeNetBenefit - employeeNetSalary)} €</div>
                </div>
              </div>
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 14, fontSize: 13.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.6 }}>
                Sivukulut lasketaan vain verotusarvosta ({fmt(calc.taxableValue)} €), ei auton todellisesta kustannuksesta ({fmt0(employerCost)} €).
                Vuositasolla työnantaja säästää <strong style={{ color: employerSavingsYear >= 0 ? GREEN_SOFT : RED_SOFT_DARK }}>{fmt(employerSavingsYear)} €</strong> per autoetu.
              </div>
            </div>
          </>
        )}

        {/* Footer note */}
        <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.65, padding: "0 4px" }}>
          Laskelma perustuu Verohallinnon päätökseen luontoisetujen laskentaperusteista vuodelle 2026 (VH/6275/00.01.00/2025). Perusarvo: ikäryhmä A (käyttöönotto 2024–2026) 1,5 %, B (2021–2023) 1,2 %, C (ennen 2021) 0,9 % uushankintahinnasta, josta vähennetty 3 400 €; tulos pyöristetään alaspäin lähimpään 10 euroon. Kaavamaiset käyttökustannukset: vapaa autoetu 285/300/315 €/kk tai 19/20/21 snt/km, käyttöetu 105/120/135 €/kk tai 7/8/9 snt/km. Käyttövoima-alennukset (vain vapaa autoetu): täyssähkö −120 €/kk tai −8 snt/km, lataushybridi ja metaanikaasu −60 €/kk tai −4 snt/km. Lisäksi nollapäästöisen auton verotusarvosta vähennetään 170 €/kk (TVL 64 a §, voimassa 2021–2029; koskee molempia etutyyppejä). Lisävarusteet huomioidaan 1 200 € ylittävältä osalta. Työnantajan sivukulut (n. 20,5 %) lasketaan verotusarvosta; todellinen prosentti vaihtelee. Marginaaliveroasteet ja kustannusarviot (auton kustannus ~1,9 % hinnasta/kk, energia, oman auton kulut) ovat viitteellisiä ja muokattavissa. Automallien hinnat ovat alkaen-suositushintoja (7/2026). Kannattavuusvertailu ei ole verosuunnittelu- tai sijoitusneuvontaa. Laskuri ei huomioi mm. runsaan työajon 80 %:n perusarvoa eikä kuljettajaetua. Todelliset verovaikutukset riippuvat yksilön tilanteesta.
          <br /><br />
          <span style={{ fontFamily: HEAD, fontWeight: 700, color: BRAND }}>Verologia.fi</span> — Työsuhde-etujen koulutus yrityksille
        </div>
      </div>
    </div>
  );
}
