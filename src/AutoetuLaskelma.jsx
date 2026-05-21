import { useState, useMemo } from "react";
 
const BRAND = "#0D263F";
const ACCENT = "#2E7D6B";
const WARM = "#F5F1EC";
const RED_SOFT = "#C4584A";
const AMBER = "#D4A33C";
 
// Autoedun verotusarvot 2026 (Verohallinnon päätös).
// Vapaa autoetu = työnantaja maksaa kaikki autokustannukset.
// Käyttöetu = työntekijä maksaa polttoaineen, työnantaja muut kustannukset.
const AUTOETU_VALUES = {
  free: {
    A: { percent: 0.015, monthly: 295 }, // 2024–2026 käyttöönotetut
    B: { percent: 0.012, monthly: 310 }, // 2021–2023
    C: { percent: 0.009, monthly: 325 }, // ennen 2021
  },
  usage: {
    A: { percent: 0.015, monthly: 110 },
    B: { percent: 0.012, monthly: 125 },
    C: { percent: 0.009, monthly: 140 },
  },
};
 
// Käyttövoiman alennus per kuukausi. Koskee VAIN vapaa autoetua (ei käyttöetua).
const FUEL_DISCOUNT = {
  petrol: 0,        // polttoaine (bensa/diesel)
  hybrid: 60,       // lataushybridi
  electric: 120,    // täyssähkö
};
 
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
 
function AnimBar({ value, max, color, label, delay = 0 }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", fontSize: 11,
        color: "rgba(13,38,63,0.55)", marginBottom: 3, fontWeight: 500,
      }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color }}>{fmt(value)} €</span>
      </div>
      <div style={{
        height: 22, borderRadius: 6,
        background: "rgba(13,38,63,0.06)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 6,
          background: color, width: `${pct}%`,
          transition: `width 0.8s cubic-bezier(0.4,0,0.2,1) ${delay}s`,
        }} />
      </div>
    </div>
  );
}
 
export default function AutoetuLaskelma() {
  const [viewMode, setViewMode] = useState("compare"); // "value" | "compare"
  const [benefitType, setBenefitType] = useState("free"); // "free" | "usage"
  const [ageClass, setAgeClass] = useState("A"); // "A" | "B" | "C"
  const [carPrice, setCarPrice] = useState(PRICE_DEFAULT);
  const [fuelType, setFuelType] = useState("petrol"); // "petrol" | "hybrid" | "electric"
  const [employerCost, setEmployerCost] = useState(EMPLOYER_COST_DEFAULT);
  const [salaryGross, setSalaryGross] = useState(3500);
  const [employees, setEmployees] = useState(30);
 
  const marginalTax = getMarginalTax(salaryGross);
 
  const handleSalaryInput = (raw) => {
    if (raw === "") { setSalaryGross(0); return; }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    setSalaryGross(Math.min(SALARY_MAX, Math.max(0, Math.round(num))));
  };
 
  const handleEmployeeInput = (raw) => {
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    setEmployees(Math.max(EMPLOYEES_MIN, Math.min(EMPLOYEES_MAX, Math.round(num))));
  };
 
  const handlePriceInput = (raw) => {
    if (raw === "") { setCarPrice(0); return; }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    setCarPrice(Math.min(PRICE_MAX, Math.max(0, Math.round(num))));
  };
 
  const handleEmployerCostInput = (raw) => {
    if (raw === "") { setEmployerCost(0); return; }
    const num = Number(raw);
    if (Number.isNaN(num)) return;
    setEmployerCost(Math.min(EMPLOYER_COST_MAX, Math.max(0, Math.round(num))));
  };
 
  const calc = useMemo(() => {
    const values = AUTOETU_VALUES[benefitType][ageClass];
 
    // Verotusarvo = prosentti × hankintahinta + kuukausimaksu - käyttövoima-alennus
    const baseValue = carPrice * values.percent;
    const monthlyFixed = values.monthly;
    // Käyttövoima-alennus koskee vain vapaa autoetua
    const fuelDiscount = benefitType === "free" ? FUEL_DISCOUNT[fuelType] : 0;
    const taxableValue = Math.max(0, baseValue + monthlyFixed - fuelDiscount);
 
    // Vertailu palkankorotukseen:
    // Työnantajan kustannus etuna = todellinen kustannus + sivukulut verotusarvosta
    const employerCostBenefit = employerCost + (taxableValue * SIVUKULUT_RATE);
    // Työntekijän nettohyöty etuna = todellinen kustannus (auton käyttöarvo) - vero verotusarvosta
    const employeeNetBenefit = employerCost - (taxableValue * marginalTax);
 
    // Palkankorotuksena samalla bruttoarvolla (= todellinen kustannus)
    const employerCostSalary = employerCost * (1 + SIVUKULUT_RATE);
    const employeeNetSalary = employerCost * (1 - marginalTax);
 
    const employerSavingsMonth = employerCostSalary - employerCostBenefit;
    const employerSavingsYear = employerSavingsMonth * 12;
    const employeeGainMonth = employeeNetBenefit - employeeNetSalary;
    const employeeGainYear = employeeGainMonth * 12;
 
    const totalEmployerSavingsYear = employerSavingsYear * employees;
 
    return {
      baseValue, monthlyFixed, fuelDiscount, taxableValue,
      employerCostBenefit, employeeNetBenefit,
      employerCostSalary, employeeNetSalary,
      employerSavingsMonth, employerSavingsYear,
      employeeGainMonth, employeeGainYear,
      totalEmployerSavingsYear,
    };
  }, [benefitType, ageClass, carPrice, fuelType, employerCost, marginalTax, employees]);
 
  const maxBar = Math.max(calc.employerCostSalary, calc.employerCostBenefit, employerCost);
 
  return (
    <div style={{
      minHeight: "100vh", background: WARM,
      fontFamily: "'Inter', sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet" />
 
      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${BRAND} 0%, #1a3a5c 100%)`,
        color: "#fff", padding: "32px 20px 26px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -30, right: -30,
          width: 140, height: 140, borderRadius: "50%",
          background: "rgba(46,125,107,0.18)",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)", marginBottom: 6,
          }}>
            Verologia · Autoetu
          </div>
          <h1 style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: 26, fontWeight: 700, margin: 0, lineHeight: 1.25,
            color: "#fff",
          }}>
            Autoetu vai palkankorotus?
          </h1>
          <p style={{
            fontSize: 14, color: "rgba(255,255,255,0.7)",
            margin: "8px 0 0", lineHeight: 1.5,
          }}>
            Laske autoedun verotusarvo ja vertaa palkankorotukseen
          </p>
        </div>
      </div>
 
      <div style={{ padding: "16px 16px 100px" }}>
 
        {/* View mode toggle */}
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: 1.2, color: "rgba(13,38,63,0.5)", marginBottom: 10,
          }}>
            Näkymä
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setViewMode("value")} style={{
              flex: 1, padding: "10px 8px", fontSize: 13, fontWeight: 600,
              border: `1.5px solid ${viewMode === "value" ? ACCENT : "rgba(13,38,63,0.1)"}`,
              borderRadius: 10,
              background: viewMode === "value" ? ACCENT : "#fff",
              color: viewMode === "value" ? "#fff" : BRAND,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.2s",
            }}>
              Verotusarvo
            </button>
            <button onClick={() => setViewMode("compare")} style={{
              flex: 1, padding: "10px 8px", fontSize: 13, fontWeight: 600,
              border: `1.5px solid ${viewMode === "compare" ? ACCENT : "rgba(13,38,63,0.1)"}`,
              borderRadius: 10,
              background: viewMode === "compare" ? ACCENT : "#fff",
              color: viewMode === "compare" ? "#fff" : BRAND,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all 0.2s",
            }}>
              Vertailu palkankorotukseen
            </button>
          </div>
        </div>
 
        {/* Benefit type */}
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: 1.2, color: "rgba(13,38,63,0.5)", marginBottom: 10,
          }}>
            Autoetutyyppi
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setBenefitType("free")} style={{
              flex: 1, padding: "12px 8px", fontSize: 13, fontWeight: 600,
              border: `2px solid ${benefitType === "free" ? ACCENT : "rgba(13,38,63,0.1)"}`,
              borderRadius: 10,
              background: benefitType === "free" ? ACCENT : "#fff",
              color: benefitType === "free" ? "#fff" : BRAND,
              cursor: "pointer", fontFamily: "inherit", lineHeight: 1.3,
              transition: "all 0.2s",
            }}>
              Vapaa autoetu
              <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>
                Työnantaja maksaa kaiken
              </div>
            </button>
            <button onClick={() => setBenefitType("usage")} style={{
              flex: 1, padding: "12px 8px", fontSize: 13, fontWeight: 600,
              border: `2px solid ${benefitType === "usage" ? ACCENT : "rgba(13,38,63,0.1)"}`,
              borderRadius: 10,
              background: benefitType === "usage" ? ACCENT : "#fff",
              color: benefitType === "usage" ? "#fff" : BRAND,
              cursor: "pointer", fontFamily: "inherit", lineHeight: 1.3,
              transition: "all 0.2s",
            }}>
              Käyttöetu
              <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>
                Työntekijä maksaa polttoaineen
              </div>
            </button>
          </div>
        </div>
 
        {/* Age class */}
        <div style={{ marginBottom: 18 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: 1.2, color: "rgba(13,38,63,0.5)", marginBottom: 10,
          }}>
            Auton ikäluokka
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["A", "B", "C"].map((cls) => (
              <button key={cls} onClick={() => setAgeClass(cls)} style={{
                flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 600,
                border: `1.5px solid ${ageClass === cls ? ACCENT : "rgba(13,38,63,0.1)"}`,
                borderRadius: 10,
                background: ageClass === cls ? ACCENT : "#fff",
                color: ageClass === cls ? "#fff" : BRAND,
                cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.2s",
              }}>
                {cls}
              </button>
            ))}
          </div>
          <div style={{
            fontSize: 11, color: "rgba(13,38,63,0.45)", marginTop: 4,
          }}>
            {ageClass === "A" && "Käyttöönotettu 2024–2026"}
            {ageClass === "B" && "Käyttöönotettu 2021–2023"}
            {ageClass === "C" && "Käyttöönotettu ennen 2021"}
          </div>
        </div>
 
        {/* Car price */}
        <div style={{ marginBottom: 22 }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 10,
          }}>
            <div style={{
              fontSize: 13, fontWeight: 600, textTransform: "uppercase",
              letterSpacing: 1.2, color: "rgba(13,38,63,0.5)",
            }}>
              Auton uushankintahinta
            </div>
            <input
              type="number"
              max={PRICE_MAX}
              step={1000}
              value={carPrice === 0 ? "" : carPrice}
              onChange={(e) => handlePriceInput(e.target.value)}
              style={{
                width: 110, padding: "6px 10px",
                fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                color: BRAND, background: "#fff",
                border: `1.5px solid rgba(13,38,63,0.15)`,
                borderRadius: 8, textAlign: "right",
                outline: "none",
              }}
            />
          </div>
          <input
            type="range"
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={1000}
            value={carPrice}
            onChange={(e) => setCarPrice(Number(e.target.value))}
            style={{ width: "100%", accentColor: ACCENT }}
          />
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 10, color: "rgba(13,38,63,0.3)",
          }}>
            <span>15 000 €</span><span>40 000 €</span><span>70 000 €</span><span>100 000 €</span>
          </div>
        </div>
 
        {/* Fuel type */}
        <div style={{ marginBottom: 22 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: 1.2, color: "rgba(13,38,63,0.5)", marginBottom: 10,
          }}>
            Käyttövoima
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[
              { id: "petrol", label: "Polttoaine", sub: "Ei alennusta" },
              { id: "hybrid", label: "Lataushybridi", sub: "−60 €/kk" },
              { id: "electric", label: "Täyssähkö", sub: "−120 €/kk" },
            ].map(f => (
              <button key={f.id} onClick={() => setFuelType(f.id)} style={{
                flex: 1, padding: "10px 6px", fontSize: 12, fontWeight: 600,
                border: `1.5px solid ${fuelType === f.id ? ACCENT : "rgba(13,38,63,0.1)"}`,
                borderRadius: 10,
                background: fuelType === f.id ? ACCENT : "#fff",
                color: fuelType === f.id ? "#fff" : BRAND,
                cursor: "pointer", fontFamily: "inherit", lineHeight: 1.3,
                transition: "all 0.2s",
              }}>
                {f.label}
                <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, marginTop: 2 }}>
                  {f.sub}
                </div>
              </button>
            ))}
          </div>
          {benefitType === "usage" && fuelType !== "petrol" && (
            <div style={{
              fontSize: 11, color: AMBER, marginTop: 6, fontWeight: 500,
            }}>
              Huom: käyttövoima-alennus ei koske käyttöetua, vain vapaa autoetua.
            </div>
          )}
        </div>
 
        {/* Tax value breakdown */}
        <div style={{
          background: "#fff", borderRadius: 14, padding: 18,
          border: `2px solid ${ACCENT}`,
          boxShadow: "0 4px 20px rgba(46,125,107,0.1)",
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: 1.5, color: ACCENT, marginBottom: 14,
          }}>
            Autoedun verotusarvo / kk
          </div>
 
          <BreakdownRow label={`Perusarvo (${(AUTOETU_VALUES[benefitType][ageClass].percent * 100).toFixed(1)} % × hinta)`} value={calc.baseValue} />
          <BreakdownRow label={`Kuukausimaksu (luokka ${ageClass}, ${benefitType === "free" ? "vapaa" : "käyttöetu"})`} value={calc.monthlyFixed} />
          {calc.fuelDiscount > 0 && (
            <BreakdownRow label={`Käyttövoima-alennus (${fuelType === "electric" ? "täyssähkö" : "lataushybridi"})`} value={-calc.fuelDiscount} negative />
          )}
 
          <div style={{
            marginTop: 10, paddingTop: 12,
            borderTop: "2px solid rgba(46,125,107,0.2)",
            display: "flex", justifyContent: "space-between",
            fontSize: 16, fontWeight: 600, color: BRAND,
          }}>
            <span>Verotusarvo yhteensä</span>
            <span style={{
              fontFamily: "'Poppins', sans-serif", fontWeight: 700, color: ACCENT, fontSize: 22,
            }}>
              {fmt(calc.taxableValue)} €
            </span>
          </div>
 
          <div style={{
            marginTop: 8, fontSize: 11, color: "rgba(13,38,63,0.5)", lineHeight: 1.5,
          }}>
            Verotusarvo lisätään palkkaan ennakonpidätyksen kohteena. Vuositasolla {fmt0(calc.taxableValue * 12)} €.
          </div>
        </div>
 
        {viewMode === "compare" && (
          <>
            {/* Employer cost */}
            <div style={{ marginBottom: 22 }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 10,
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: 1.2, color: "rgba(13,38,63,0.5)",
                }}>
                  Työnantajan todellinen kustannus / kk
                </div>
                <input
                  type="number"
                  max={EMPLOYER_COST_MAX}
                  step={50}
                  value={employerCost === 0 ? "" : employerCost}
                  onChange={(e) => handleEmployerCostInput(e.target.value)}
                  style={{
                    width: 100, padding: "6px 10px",
                    fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                    color: BRAND, background: "#fff",
                    border: `1.5px solid rgba(13,38,63,0.15)`,
                    borderRadius: 8, textAlign: "right",
                    outline: "none",
                  }}
                />
              </div>
              <input
                type="range"
                min={EMPLOYER_COST_MIN}
                max={EMPLOYER_COST_MAX}
                step={50}
                value={employerCost}
                onChange={(e) => setEmployerCost(Number(e.target.value))}
                style={{ width: "100%", accentColor: ACCENT }}
              />
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 10, color: "rgba(13,38,63,0.3)",
              }}>
                <span>300 €</span><span>800 €</span><span>1 300 €</span><span>2 000 €</span>
              </div>
              <div style={{
                fontSize: 11, color: "rgba(13,38,63,0.45)", marginTop: 4,
              }}>
                Leasing/poistot + polttoaine + vakuutus + huolto + ajoneuvovero. Tyypillinen 650–1 200 €/kk riippuen autosta.
              </div>
            </div>
 
            {/* Salary */}
            <div style={{ marginBottom: 18 }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 10, flexWrap: "wrap", gap: 8,
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: 1.2, color: "rgba(13,38,63,0.5)",
                }}>
                  Työntekijän palkkataso (marginaalivero {Math.round(marginalTax * 100)} %)
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "rgba(13,38,63,0.5)" }}>
                    Tai oma palkka:
                  </span>
                  <input
                    type="number"
                    max={SALARY_MAX}
                    step={100}
                    value={salaryGross === 0 ? "" : salaryGross}
                    onChange={(e) => handleSalaryInput(e.target.value)}
                    style={{
                      width: 100, padding: "6px 10px",
                      fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                      color: BRAND, background: "#fff",
                      border: `1.5px solid rgba(13,38,63,0.15)`,
                      borderRadius: 8, textAlign: "right",
                      outline: "none",
                    }}
                  />
                  <span style={{ fontSize: 11, color: "rgba(13,38,63,0.5)" }}>€/kk</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {SALARY_EXAMPLES.map((s) => (
                  <button key={s.gross} onClick={() => setSalaryGross(s.gross)} style={{
                    padding: "8px 10px", fontSize: 12, fontWeight: 500,
                    border: `1.5px solid ${s.gross === salaryGross ? ACCENT : "rgba(13,38,63,0.1)"}`,
                    borderRadius: 8,
                    background: s.gross === salaryGross ? ACCENT : "#fff",
                    color: s.gross === salaryGross ? "#fff" : BRAND,
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.2s",
                  }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
 
            {/* Employees */}
            <div style={{ marginBottom: 22 }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 10,
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, textTransform: "uppercase",
                  letterSpacing: 1.2, color: "rgba(13,38,63,0.5)",
                }}>
                  Autoedun saavien määrä
                </div>
                <input
                  type="number"
                  min={EMPLOYEES_MIN}
                  max={EMPLOYEES_MAX}
                  value={employees}
                  onChange={(e) => handleEmployeeInput(e.target.value)}
                  style={{
                    width: 90, padding: "6px 10px",
                    fontSize: 14, fontWeight: 700, fontFamily: "inherit",
                    color: BRAND, background: "#fff",
                    border: `1.5px solid rgba(13,38,63,0.15)`,
                    borderRadius: 8, textAlign: "right",
                    outline: "none",
                  }}
                />
              </div>
              <input
                type="range"
                min={EMPLOYEES_MIN}
                max={EMPLOYEES_MAX}
                value={employees}
                onChange={(e) => setEmployees(Number(e.target.value))}
                style={{ width: "100%", accentColor: ACCENT }}
              />
              <div style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 10, color: "rgba(13,38,63,0.3)",
              }}>
                <span>1</span><span>250</span><span>500</span><span>750</span><span>1000</span>
              </div>
            </div>
 
            {/* Comparison cards */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
              marginBottom: 16,
            }}>
              <div style={{
                background: "#fff", borderRadius: 14, padding: 16,
                border: `1px solid rgba(196,88,74,0.2)`,
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 1.5, color: RED_SOFT, marginBottom: 12,
                }}>
                  Palkankorotus
                </div>
                <div style={{ fontSize: 11, color: "rgba(13,38,63,0.5)", marginBottom: 4 }}>
                  Työnantaja maksaa /kk
                </div>
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 22, fontWeight: 700, color: RED_SOFT, marginBottom: 12,
                }}>
                  {fmt(calc.employerCostSalary)} €
                </div>
                <div style={{ fontSize: 11, color: "rgba(13,38,63,0.5)", marginBottom: 4 }}>
                  Työntekijä saa käteen /kk
                </div>
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 22, fontWeight: 700, color: BRAND,
                }}>
                  {fmt(calc.employeeNetSalary)} €
                </div>
              </div>
 
              <div style={{
                background: "#fff", borderRadius: 14, padding: 16,
                border: `2px solid ${ACCENT}`,
                boxShadow: "0 4px 20px rgba(46,125,107,0.1)",
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: 1.5, color: ACCENT, marginBottom: 12,
                }}>
                  Autoetu ✓
                </div>
                <div style={{ fontSize: 11, color: "rgba(13,38,63,0.5)", marginBottom: 4 }}>
                  Työnantaja maksaa /kk
                </div>
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 22, fontWeight: 700, color: ACCENT, marginBottom: 12,
                }}>
                  {fmt(calc.employerCostBenefit)} €
                </div>
                <div style={{ fontSize: 11, color: "rgba(13,38,63,0.5)", marginBottom: 4 }}>
                  Työntekijän nettohyöty /kk
                </div>
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 22, fontWeight: 700, color: BRAND,
                }}>
                  {fmt(calc.employeeNetBenefit)} €
                </div>
              </div>
            </div>
 
            {/* Visual bars */}
            <div style={{
              background: "#fff", borderRadius: 14, padding: 16,
              border: "1px solid rgba(13,38,63,0.08)",
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 1.2, color: "rgba(13,38,63,0.5)", marginBottom: 12,
              }}>
                Työnantajan kustannus / kuukausi
              </div>
              <AnimBar value={calc.employerCostSalary} max={maxBar} color={RED_SOFT} label="Palkankorotus (brutto + sivukulut 20,5 %)" delay={0.1} />
              <AnimBar value={calc.employerCostBenefit} max={maxBar} color={ACCENT} label="Autoetu (sivukulut vain verotusarvosta)" delay={0.2} />
 
              <div style={{
                marginTop: 14, fontSize: 13, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 1.2, color: "rgba(13,38,63,0.5)", marginBottom: 12,
              }}>
                Työntekijän nettohyöty / kuukausi
              </div>
              <AnimBar value={Math.max(0, calc.employeeNetSalary)} max={employerCost || 1} color={RED_SOFT} label={`Palkankorotus (marginaalivero ${Math.round(marginalTax * 100)} %)`} delay={0.3} />
              <AnimBar value={Math.max(0, calc.employeeNetBenefit)} max={employerCost || 1} color={ACCENT} label="Autoetu (vero vain verotusarvosta)" delay={0.4} />
            </div>
 
            {/* Key insight */}
            <div style={{
              background: `linear-gradient(135deg, ${BRAND} 0%, #1a3a5c 100%)`,
              borderRadius: 14, padding: 20, color: "#fff",
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 2, color: "rgba(255,255,255,0.5)", marginBottom: 14,
              }}>
                Yhteenveto
              </div>
 
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                    Työnantaja säästää /kk
                  </div>
                  <div style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 22, fontWeight: 700,
                    color: calc.employerSavingsMonth >= 0 ? "#7FDBBA" : "#E8C97A",
                  }}>
                    {fmt(calc.employerSavingsMonth)} €
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                    Työntekijä hyötyy /kk
                  </div>
                  <div style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 22, fontWeight: 700,
                    color: calc.employeeGainMonth >= 0 ? "#7FDBBA" : "#E8C97A",
                  }}>
                    {calc.employeeGainMonth >= 0 ? "+" : ""}{fmt(calc.employeeGainMonth)} €
                  </div>
                </div>
              </div>
 
              <div style={{
                borderTop: "1px solid rgba(255,255,255,0.1)",
                paddingTop: 14,
                fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.6,
              }}>
                Sivukulut lasketaan vain verotusarvosta ({fmt(calc.taxableValue)} €), ei työnantajan todellisesta kustannuksesta ({fmt0(employerCost)} €).
                Tämä on autoedun verotuksellinen etu palkankorotukseen verrattuna.
                Vuositasolla työnantaja säästää <strong style={{ color: calc.employerSavingsYear >= 0 ? "#7FDBBA" : "#E8C97A" }}>{fmt(calc.employerSavingsYear)} €</strong> per autoetu.
              </div>
            </div>
 
            {/* Scale */}
            <div style={{
              background: "#fff", borderRadius: 14, padding: 16,
              border: "1px solid rgba(13,38,63,0.08)",
              marginBottom: 16,
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: 1.5, color: "rgba(13,38,63,0.5)", marginBottom: 10,
              }}>
                {employees} autoetua / vuosi
              </div>
              <div style={{
                fontSize: 11, color: "rgba(13,38,63,0.5)", marginBottom: 4,
              }}>
                Työnantajan kokonaissäästö
              </div>
              <div style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 28, fontWeight: 700,
                color: calc.totalEmployerSavingsYear >= 0 ? ACCENT : AMBER,
              }}>
                {fmt(calc.totalEmployerSavingsYear)} €
              </div>
            </div>
          </>
        )}
 
        {viewMode === "value" && (
          <div style={{
            background: "rgba(46,125,107,0.06)",
            borderRadius: 12, padding: "16px 18px",
            border: "1px solid rgba(46,125,107,0.18)",
            marginBottom: 16,
            fontSize: 13, color: BRAND, lineHeight: 1.6,
          }}>
            <strong>Mitä tämä tarkoittaa palkalle:</strong> Verotusarvo {fmt(calc.taxableValue)} €/kk lisätään ennakonpidätyksessä työntekijän kuukausipalkkaan. Esimerkiksi 3 500 €/kk peruspalkka + autoetu = {fmt0(3500 + calc.taxableValue)} €/kk verotettavaa tuloa. Työnantaja maksaa sivukulut (20,5 %) tämän verotusarvon perusteella, ei auton todellisesta kustannuksesta.
            <br /><br />
            <span style={{ color: "rgba(13,38,63,0.55)", fontSize: 12 }}>
              Vaihda näkymä "Vertailu palkankorotukseen" yläosasta nähdäksesi miten autoetu vertautuu vastaavalla bruttoarvolla annettuun palkankorotukseen.
            </span>
          </div>
        )}
 
        {/* Footer note */}
        <div style={{
          fontSize: 10, color: "rgba(13,38,63,0.35)", lineHeight: 1.6,
          padding: "0 4px",
        }}>
          Laskelma perustuu Verohallinnon vuoden 2026 päätökseen autoedun verotusarvoista. Ikäluokat: A = käyttöönotettu 2024–2026 (1,5 % × hankintahinta), B = 2021–2023 (1,2 %), C = ennen 2021 (0,9 %). Kuukausimaksut: vapaa autoetu 295/310/325 €/kk, käyttöetu 110/125/140 €/kk. Käyttövoima-alennukset 2026 (vain vapaa autoetu): täyssähkö −120 €/kk, lataushybridi −60 €/kk. Työnantajan sivukulut 20,5 % (TyEL, sairausvakuutus, työttömyysvakuutus, tapaturmavakuutus, ryhmähenkivakuutus) lasketaan verotusarvosta. Marginaaliveroasteet ovat viitteellisiä. Laskuri ei kata kilometripohjaista arvostusta eikä lisävarustelua. Todelliset verovaikutukset riippuvat yksilön tilanteesta.
          <br /><br />
          Verologia.fi — Työsuhde-etujen koulutus yrityksille
        </div>
      </div>
    </div>
  );
}
 
function BreakdownRow({ label, value, negative }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "8px 0",
      fontSize: 13, color: "#0D263F",
    }}>
      <span style={{ color: "rgba(13,38,63,0.7)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: negative ? "#2E7D6B" : "#0D263F" }}>
        {value >= 0 ? "" : "−"}{fmt(Math.abs(value))} €
      </span>
    </div>
  );
}
