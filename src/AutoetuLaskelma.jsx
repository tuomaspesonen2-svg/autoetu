import { useState, useMemo } from "react";

/* Verologia-laskuri – sivuston design-järjestelmä (Bricolage Grotesque + Inter) */
const BRAND = "#0D263F";
const NAVY_2 = "#0A1E33";
const ACCENT = "#3C72AB";     // brändi / interaktiiviset elementit
const GREEN = "#1F8A5B";      // säästö / positiivinen
const GREEN_SOFT = "#7FDBBA"; // säästö tummalla taustalla
const GREEN_PANEL = "#E3F2EA";
const RED_SOFT = "#C4584A";   // lisäkustannus / epäedullinen
const RED_SOFT_DARK = "#E8897E"; // punainen tummalla taustalla
const AMBER = "#D4A33C";      // varoitushuomio
const WARM = "#FFFFFF";
const SAND = "#F3F2EC";
const LINE = "#E4E0D6";
const MUTED = "#5A6675";

const HEAD = "'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

const AUTOETU_VALUES = {
free: {
A: { percent: 0.015, monthly: 295 },
B: { percent: 0.012, monthly: 310 },
C: { percent: 0.009, monthly: 325 },
},
usage: {
A: { percent: 0.015, monthly: 110 },
B: { percent: 0.012, monthly: 125 },
C: { percent: 0.009, monthly: 140 },
},
};

const FUEL_DISCOUNT = { petrol: 0, hybrid: 60, electric: 120 };

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
const EMPLOYEES_MIN = 1;
const EMPLOYEES_MAX = 1000;
const PRICE_MIN = 15000;
const PRICE_MAX = 100000;
const PRICE_DEFAULT = 45000;
const EMPLOYER_COST_MIN = 300;
const EMPLOYER_COST_MAX = 2000;
const EMPLOYER_COST_DEFAULT = 950;

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
`;

const labelStyle = { fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: MUTED };
const numInput = { padding: "6px 10px", fontFamily: HEAD, fontSize: 14, fontWeight: 700, color: BRAND, background: "#fff", border: `1.5px solid ${LINE}`, borderRadius: 8, textAlign: "right", outline: "none" };

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

export default function AutoetuLaskelma() {
const [viewMode, setViewMode] = useState("compare");
const [benefitType, setBenefitType] = useState("free");
const [ageClass, setAgeClass] = useState("A");
const [carPrice, setCarPrice] = useState(PRICE_DEFAULT);
const [fuelType, setFuelType] = useState("petrol");
const [employerCost, setEmployerCost] = useState(EMPLOYER_COST_DEFAULT);
const [salaryGross, setSalaryGross] = useState(3500);
const [employees, setEmployees] = useState(30);

const marginalTax = getMarginalTax(salaryGross);

const handleSalaryInput = (raw) => {
if (raw === "") { setSalaryGross(0); return; }
const num = Number(raw); if (Number.isNaN(num)) return;
setSalaryGross(Math.min(SALARY_MAX, Math.max(0, Math.round(num))));
};
const handleEmployeeInput = (raw) => {
const num = Number(raw); if (Number.isNaN(num)) return;
setEmployees(Math.max(EMPLOYEES_MIN, Math.min(EMPLOYEES_MAX, Math.round(num))));
};
const handlePriceInput = (raw) => {
if (raw === "") { setCarPrice(0); return; }
const num = Number(raw); if (Number.isNaN(num)) return;
setCarPrice(Math.min(PRICE_MAX, Math.max(0, Math.round(num))));
};
const handleEmployerCostInput = (raw) => {
if (raw === "") { setEmployerCost(0); return; }
const num = Number(raw); if (Number.isNaN(num)) return;
setEmployerCost(Math.min(EMPLOYER_COST_MAX, Math.max(0, Math.round(num))));
};

const calc = useMemo(() => {
const values = AUTOETU_VALUES[benefitType][ageClass];
const baseValue = carPrice * values.percent;
const monthlyFixed = values.monthly;
const fuelDiscount = benefitType === "free" ? FUEL_DISCOUNT[fuelType] : 0;
const taxableValue = Math.max(0, baseValue + monthlyFixed - fuelDiscount);
const employerCostBenefit = employerCost + (taxableValue * SIVUKULUT_RATE);
const employeeNetBenefit = employerCost - (taxableValue * marginalTax);
const employerCostSalary = employerCost * (1 + SIVUKULUT_RATE);
const employeeNetSalary = employerCost * (1 - marginalTax);
const employerSavingsMonth = employerCostSalary - employerCostBenefit;
const employerSavingsYear = employerSavingsMonth * 12;
const employeeGainMonth = employeeNetBenefit - employeeNetSalary;
const employeeGainYear = employeeGainMonth * 12;
const totalEmployerSavingsYear = employerSavingsYear * employees;
return {
baseValue, monthlyFixed, fuelDiscount, taxableValue,
employerCostBenefit, employeeNetBenefit, employerCostSalary, employeeNetSalary,
employerSavingsMonth, employerSavingsYear, employeeGainMonth, employeeGainYear, totalEmployerSavingsYear,
};
}, [benefitType, ageClass, carPrice, fuelType, employerCost, marginalTax, employees]);

const maxBar = Math.max(calc.employerCostSalary, calc.employerCostBenefit, employerCost);
const card = { background: "#fff", borderRadius: 12, padding: 18, border: `1px solid ${LINE}`, boxShadow: "0 10px 30px -16px rgba(28,40,30,.22)" };

return (
<div style={{ minHeight: "100vh", background: WARM, fontFamily: BODY, color: "#14202E" }}>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
<style>{sliderCSS}</style>

{/* Header */}
<div style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${NAVY_2} 100%)`, color: "#fff", padding: "34px 20px 28px", position: "relative", overflow: "hidden", textAlign: "center" }}>
<div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(60,114,171,0.22)" }} />
<div style={{ position: "relative" }}>
<div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>Verologia · Autoetu</div>
<h1 style={{ fontFamily: HEAD, fontSize: 28, fontWeight: 800, margin: "10px 0 0", lineHeight: 1.05, letterSpacing: "-.028em", color: "#fff" }}>Autoetu vai palkankorotus?</h1>
<p style={{ fontFamily: BODY, fontSize: 14.5, color: "rgba(255,255,255,0.72)", margin: "10px auto 0", lineHeight: 1.55, maxWidth: 540 }}>Laske autoedun verotusarvo ja vertaa palkankorotukseen.</p>
</div>
</div>

<div style={{ padding: "20px 16px 100px", maxWidth: 720, margin: "0 auto" }}>

{/* View mode */}
<div style={{ marginBottom: 18 }}>
<div style={{ ...labelStyle, marginBottom: 10 }}>Näkymä</div>
<div style={{ display: "flex", gap: 8 }}>
<ChoiceBtn active={viewMode === "value"} onClick={() => setViewMode("value")}>Verotusarvo</ChoiceBtn>
<ChoiceBtn active={viewMode === "compare"} onClick={() => setViewMode("compare")}>Vertailu palkankorotukseen</ChoiceBtn>
</div>
</div>

{/* Benefit type */}
<div style={{ marginBottom: 18 }}>
<div style={{ ...labelStyle, marginBottom: 10 }}>Autoetutyyppi</div>
<div style={{ display: "flex", gap: 8 }}>
<ChoiceBtn two active={benefitType === "free"} onClick={() => setBenefitType("free")}>
Vapaa autoetu<div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>Työnantaja maksaa kaiken</div>
</ChoiceBtn>
<ChoiceBtn two active={benefitType === "usage"} onClick={() => setBenefitType("usage")}>
Käyttöetu<div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>Työntekijä maksaa polttoaineen</div>
</ChoiceBtn>
</div>
</div>

{/* Age class */}
<div style={{ marginBottom: 18 }}>
<div style={{ ...labelStyle, marginBottom: 10 }}>Auton ikäluokka</div>
<div style={{ display: "flex", gap: 6 }}>
{["A", "B", "C"].map((cls) => (
<ChoiceBtn key={cls} active={ageClass === cls} onClick={() => setAgeClass(cls)}>{cls}</ChoiceBtn>
))}
</div>
<div style={{ fontFamily: BODY, fontSize: 11.5, color: MUTED, marginTop: 6 }}>
{ageClass === "A" && "Käyttöönotettu 2024–2026"}
{ageClass === "B" && "Käyttöönotettu 2021–2023"}
{ageClass === "C" && "Käyttöönotettu ennen 2021"}
</div>
</div>

{/* Car price */}
<div style={{ marginBottom: 22 }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
<div style={labelStyle}>Auton uushankintahinta</div>
<input type="number" max={PRICE_MAX} step={1000} value={carPrice === 0 ? "" : carPrice} onChange={(e) => handlePriceInput(e.target.value)} style={{ ...numInput, width: 110 }} />
</div>
<input className="vl-range" type="range" min={PRICE_MIN} max={PRICE_MAX} step={1000} value={carPrice} onChange={(e) => setCarPrice(Number(e.target.value))} />
<div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(13,38,63,0.4)", marginTop: 6 }}>
<span>15 000 €</span><span>40 000 €</span><span>70 000 €</span><span>100 000 €</span>
</div>
</div>

{/* Fuel type */}
<div style={{ marginBottom: 22 }}>
<div style={{ ...labelStyle, marginBottom: 10 }}>Käyttövoima</div>
<div style={{ display: "flex", gap: 6 }}>
{[
{ id: "petrol", label: "Polttoaine", sub: "Ei alennusta" },
{ id: "hybrid", label: "Lataushybridi", sub: "−60 €/kk" },
{ id: "electric", label: "Täyssähkö", sub: "−120 €/kk" },
].map(f => (
<ChoiceBtn key={f.id} active={fuelType === f.id} onClick={() => setFuelType(f.id)}>
{f.label}<div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>{f.sub}</div>
</ChoiceBtn>
))}
</div>
{benefitType === "usage" && fuelType !== "petrol" && (
<div style={{ fontFamily: BODY, fontSize: 11.5, color: AMBER, marginTop: 6, fontWeight: 600 }}>
Huom: käyttövoima-alennus ei koske käyttöetua, vain vapaa autoetua.
</div>
)}
</div>

{/* Tax value breakdown */}
<div style={{ ...card, border: `2px solid ${ACCENT}`, boxShadow: "0 10px 30px -14px rgba(60,114,171,0.4)", marginBottom: 16 }}>
<div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: ACCENT, marginBottom: 14 }}>Autoedun verotusarvo / kk</div>
<BreakdownRow label={`Perusarvo (${(AUTOETU_VALUES[benefitType][ageClass].percent * 100).toFixed(1)} % × hinta)`} value={calc.baseValue} />
<BreakdownRow label={`Kuukausimaksu (luokka ${ageClass}, ${benefitType === "free" ? "vapaa" : "käyttöetu"})`} value={calc.monthlyFixed} />
{calc.fuelDiscount > 0 && (
<BreakdownRow label={`Käyttövoima-alennus (${fuelType === "electric" ? "täyssähkö" : "lataushybridi"})`} value={-calc.fuelDiscount} negative />
)}
<div style={{ marginTop: 10, paddingTop: 12, borderTop: `2px solid ${LINE}`, display: "flex", justifyContent: "space-between", fontFamily: BODY, fontSize: 15, fontWeight: 600, color: BRAND }}>
<span>Verotusarvo yhteensä</span>
<span style={{ fontFamily: HEAD, fontWeight: 800, color: ACCENT, fontSize: 22, letterSpacing: "-.02em" }}>{fmt(calc.taxableValue)} €</span>
</div>
<div style={{ marginTop: 8, fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
Verotusarvo lisätään palkkaan ennakonpidätyksen kohteena. Vuositasolla {fmt0(calc.taxableValue * 12)} €.
</div>
</div>

{viewMode === "compare" && (
<>
{/* Employer cost */}
<div style={{ marginBottom: 22 }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
<div style={labelStyle}>Työnantajan todellinen kustannus / kk</div>
<input type="number" max={EMPLOYER_COST_MAX} step={50} value={employerCost === 0 ? "" : employerCost} onChange={(e) => handleEmployerCostInput(e.target.value)} style={{ ...numInput, width: 100 }} />
</div>
<input className="vl-range" type="range" min={EMPLOYER_COST_MIN} max={EMPLOYER_COST_MAX} step={50} value={employerCost} onChange={(e) => setEmployerCost(Number(e.target.value))} />
<div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(13,38,63,0.4)", marginTop: 6 }}>
<span>300 €</span><span>800 €</span><span>1 300 €</span><span>2 000 €</span>
</div>
<div style={{ fontFamily: BODY, fontSize: 11.5, color: MUTED, marginTop: 6, lineHeight: 1.5 }}>
Leasing/poistot + polttoaine + vakuutus + huolto + ajoneuvovero. Tyypillinen 650–1 200 €/kk riippuen autosta.
</div>
</div>

{/* Salary */}
<div style={{ marginBottom: 18 }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
<div style={labelStyle}>Palkkataso (marginaalivero {Math.round(marginalTax * 100)} %)</div>
<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
<span style={{ fontFamily: BODY, fontSize: 11, color: MUTED }}>Tai oma palkka:</span>
<input type="number" max={SALARY_MAX} step={100} value={salaryGross === 0 ? "" : salaryGross} onChange={(e) => handleSalaryInput(e.target.value)} style={{ ...numInput, width: 100 }} />
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

{/* Employees */}
<div style={{ marginBottom: 22 }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
<div style={labelStyle}>Autoedun saavien määrä</div>
<input type="number" min={EMPLOYEES_MIN} max={EMPLOYEES_MAX} value={employees} onChange={(e) => handleEmployeeInput(e.target.value)} style={{ ...numInput, width: 90 }} />
</div>
<input className="vl-range" type="range" min={EMPLOYEES_MIN} max={EMPLOYEES_MAX} value={employees} onChange={(e) => setEmployees(Number(e.target.value))} />
<div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "rgba(13,38,63,0.4)", marginTop: 6 }}>
<span>1</span><span>250</span><span>500</span><span>750</span><span>1000</span>
</div>
</div>

{/* Comparison cards */}
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
<div style={{ ...card, background: SAND, boxShadow: "none" }}>
<div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: MUTED, marginBottom: 12 }}>Palkankorotus</div>
<div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Työnantaja maksaa /kk</div>
<div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, color: "#14202E", letterSpacing: "-.02em", marginBottom: 12 }}>{fmt(calc.employerCostSalary)} €</div>
<div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Työntekijä saa käteen /kk</div>
<div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, color: BRAND, letterSpacing: "-.02em" }}>{fmt(calc.employeeNetSalary)} €</div>
</div>
<div style={{ ...card, border: `2px solid ${ACCENT}`, boxShadow: "0 10px 30px -14px rgba(60,114,171,0.4)" }}>
<div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: ACCENT, marginBottom: 12 }}>Autoetu ✓</div>
<div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Työnantaja maksaa /kk</div>
<div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, color: ACCENT, letterSpacing: "-.02em", marginBottom: 12 }}>{fmt(calc.employerCostBenefit)} €</div>
<div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Työntekijän nettohyöty /kk</div>
<div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, color: BRAND, letterSpacing: "-.02em" }}>{fmt(calc.employeeNetBenefit)} €</div>
</div>
</div>

{/* Bars */}
<div style={{ ...card, marginBottom: 16 }}>
<div style={{ ...labelStyle, marginBottom: 14 }}>Työnantajan kustannus / kuukausi</div>
<AnimBar value={calc.employerCostSalary} max={maxBar} color={RED_SOFT} label="Palkankorotus (brutto + sivukulut 20,5 %)" delay={0.1} />
<AnimBar value={calc.employerCostBenefit} max={maxBar} color={GREEN} label="Autoetu (sivukulut vain verotusarvosta)" delay={0.2} />
<div style={{ ...labelStyle, margin: "14px 0" }}>Työntekijän nettohyöty / kuukausi</div>
<AnimBar value={Math.max(0, calc.employeeNetSalary)} max={employerCost || 1} color={RED_SOFT} label={`Palkankorotus (marginaalivero ${Math.round(marginalTax * 100)} %)`} delay={0.3} />
<AnimBar value={Math.max(0, calc.employeeNetBenefit)} max={employerCost || 1} color={GREEN} label="Autoetu (vero vain verotusarvosta)" delay={0.4} />
</div>

{/* Summary */}
<div style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${NAVY_2} 100%)`, borderRadius: 12, padding: 22, color: "#fff", marginBottom: 16 }}>
<div style={{ fontFamily: BODY, fontSize: 12, fontWeight: 700, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 14 }}>Yhteenveto</div>
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
<div>
<div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>Työnantaja säästää /kk</div>
<div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: calc.employerSavingsMonth >= 0 ? GREEN_SOFT : RED_SOFT_DARK }}>{fmt(calc.employerSavingsMonth)} €</div>
</div>
<div>
<div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>Työntekijä hyötyy /kk</div>
<div style={{ fontFamily: HEAD, fontSize: 22, fontWeight: 800, letterSpacing: "-.02em", color: calc.employeeGainMonth >= 0 ? GREEN_SOFT : RED_SOFT_DARK }}>{calc.employeeGainMonth >= 0 ? "+" : ""}{fmt(calc.employeeGainMonth)} €</div>
</div>
</div>
<div style={{ borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 14, fontSize: 13.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.6 }}>
Sivukulut lasketaan vain verotusarvosta ({fmt(calc.taxableValue)} €), ei työnantajan todellisesta kustannuksesta ({fmt0(employerCost)} €).
Tämä on autoedun verotuksellinen etu palkankorotukseen verrattuna.
Vuositasolla työnantaja säästää <strong style={{ color: calc.employerSavingsYear >= 0 ? GREEN_SOFT : RED_SOFT_DARK }}>{fmt(calc.employerSavingsYear)} €</strong> per autoetu.
</div>
</div>

{/* Scale */}
<div style={{ ...card, marginBottom: 16, textAlign: "center" }}>
<div style={{ ...labelStyle, marginBottom: 10 }}>{employees} autoetua / vuosi</div>
<div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>Työnantajan kokonaissäästö</div>
<div style={{ fontFamily: HEAD, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em", color: calc.totalEmployerSavingsYear >= 0 ? GREEN : RED_SOFT }}>{fmt(calc.totalEmployerSavingsYear)} €</div>
</div>
</>
)}

{viewMode === "value" && (
<div style={{ background: "rgba(60,114,171,0.06)", borderRadius: 12, padding: "16px 18px", border: `1px solid ${ACCENT}33`, marginBottom: 16, fontSize: 13, color: BRAND, lineHeight: 1.6 }}>
<strong>Mitä tämä tarkoittaa palkalle:</strong> Verotusarvo {fmt(calc.taxableValue)} €/kk lisätään ennakonpidätyksessä työntekijän kuukausipalkkaan. Esimerkiksi 3 500 €/kk peruspalkka + autoetu = {fmt0(3500 + calc.taxableValue)} €/kk verotettavaa tuloa. Työnantaja maksaa sivukulut (20,5 %) tämän verotusarvon perusteella, ei auton todellisesta kustannuksesta.
<br /><br />
<span style={{ color: MUTED, fontSize: 12 }}>Vaihda näkymä "Vertailu palkankorotukseen" yläosasta nähdäksesi miten autoetu vertautuu vastaavalla bruttoarvolla annettuun palkankorotukseen.</span>
</div>
)}

{/* Footer note */}
<div style={{ fontSize: 11, color: MUTED, lineHeight: 1.65, padding: "0 4px" }}>
Laskelma perustuu Verohallinnon vuoden 2026 päätökseen autoedun verotusarvoista. Ikäluokat: A = käyttöönotettu 2024–2026 (1,5 % × hankintahinta), B = 2021–2023 (1,2 %), C = ennen 2021 (0,9 %). Kuukausimaksut: vapaa autoetu 295/310/325 €/kk, käyttöetu 110/125/140 €/kk. Käyttövoima-alennukset 2026 (vain vapaa autoetu): täyssähkö −120 €/kk, lataushybridi −60 €/kk. Työnantajan sivukulut 20,5 % (TyEL, sairausvakuutus, työttömyysvakuutus, tapaturmavakuutus, ryhmähenkivakuutus) lasketaan verotusarvosta. Marginaaliveroasteet ovat viitteellisiä. Laskuri ei kata kilometripohjaista arvostusta eikä lisävarustelua. Todelliset verovaikutukset riippuvat yksilön tilanteesta.
<br /><br />
<span style={{ fontFamily: HEAD, fontWeight: 700, color: BRAND }}>Verologia.fi</span> — Työsuhde-etujen koulutus yrityksille
</div>
</div>
</div>
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
