# Latvian UX Terminology Style Guide

## 1. Pamatprincipi

1.1 Raksti kā produkts, nevis tulkojums
- ❌ Šis ir aktīvais pieņēmumu kopums, kas tiek izmantots aprēķinos
- ✅ Aktīvie pieņēmumi aprēķinam

1.2 Maksimāli īsi
- ❌ Dzēst izvēlēto melnrakstu
- ✅ Dzēst

1.3 Konsekvence > precizitāte — ja termins ir izvēlēts, lieto VIENMĒR to pašu.

1.4 Izvairies no "grāmatvedības valodas"
- ❌ darbaspēks, izmaksu posteņi
- ✅ darba laiks, izmaksas

## 2. Galvenā terminoloģija

### 2.1 Core biznesa termini
| EN | LV (obligāts) | Neizmantot |
|---|---|---|
| Quote | Piedāvājums | Tāme |
| RFQ | Cenu pieprasījums | RFQ |
| Cost | Izmaksas | Pašizmaksa (UI) |
| Sell price | Pārdošanas cena | Realizācijas cena |
| Unit price | Cena/gab. | Cena par vienību |

### 2.2 Costing / pricing
| EN | LV |
|---|---|
| Cost-plus | Izmaksas + uzcenojums |
| Margin | Marža |
| Markup | Uzcenojums |
| Profitability | Rentabilitāte |

Nekad nelietot: izmaksu plus, cost plus

### 2.3 Rates
| EN | LV |
|---|---|
| Rate | Likme |
| Machine rate | Iekārtas likme |
| Labor rate | Darba likme |

Ja ir EUR/h → vienmēr "likme"

### 2.4 Labor
| EN | LV |
|---|---|
| Labor | Darba laiks |
| Labor cost | Darba izmaksas |

Nelietot: darbaspēks (UI)

### 2.5 Operations / manufacturing
| EN | LV |
|---|---|
| Operation | Operācija |
| Route | Maršruts |
| Setup | Sagatavošana |
| Cycle time | Cikls |
| Scrap | Brāķis |

### 2.6 Materials
| EN | LV |
|---|---|
| Material | Materiāls |
| Stock | Sagatave |
| Scrap recovery | Atgriezumu vērtība |

### 2.7 UI / system
| EN | LV |
|---|---|
| Profile | Profils |
| Resources | Resursi |
| Draft | Melnraksts |
| Save | Saglabāt |
| Delete | Dzēst |

## 3. Teksta stils

3.1 Pogas (buttons) — vienmēr darbības vārds
| Pareizi | Nepareizi |
|---|---|
| Saglabāt | Saglabāt melnrakstu |
| Dzēst | Dzēst izvēlēto ierakstu |
| Importēt | Importēt datus no ERP sistēmas |

3.2 Tabu nosaukumi — maksimums 1-2 vārdi
| Pareizi | Nepareizi |
|---|---|
| Operācijas | Tehnoloģiskās operācijas |
| Materiāli | Materiālu bibliotēka |
| Instrumenti | Instrumentu pārbaude |

3.3 Apraksti — 1 īss teikums
| Nepareizi | Pareizi |
|---|---|
| Šī funkcionalitāte ļauj lietotājam… | Ievadi detaļas datus |
| Sistēma aprēķina… | Aprēķina izmaksas |

## 4. Konsekvences noteikumi

4.1 Viena nozīme = viens termins (Quote→Piedāvājums, Labor→Darba laiks, Cost-plus→Izmaksas + uzcenojums always)

4.2 Nekad nemiksēt: Tāme/Piedāvājums, Darbaspēks/Darba laiks — izvēlies vienu un pieturies

4.3 Saīsinājumi: EUR/pc → EUR/gab., per hour → /h

## 5. Aizliegtie patterni

5.1 Tiešie tulkojumi
- ❌ balstīts uz, ❌ tiek izmantots, ❌ veic aprēķinu
- ✅ aprēķina, ✅ izmanto

5.2 Smagnēji teikumi
- ❌ Šī funkcionalitāte nodrošina iespēju
- ✅ Var

5.3 Pārlieku tehniska valoda UI
- ❌ pašizmaksas struktūra
- ✅ izmaksu sadalījums

Note: this "keep it simple" rule (3.1-3.3, 5.2, 5.3) applies to interactive UI (Quote, Client Portal, Profile, Resources, Market Rates, Scenarios, Profitability views). The Guide and Methods views are documentation/explainer content and may use full sentences and more technical precision where the concept genuinely requires it -- but must still avoid the specific forbidden words in section 2 and the literal forbidden patterns in 5.1.

## 6. QA checklist (pirms commit)
- Vai tas skan dabiski latviski?
- Vai var vēl saīsināt?
- Vai šis termins jau citur nav citādāks?
- Vai tas ir UI (vienkārši) vai dokumentācija?
