Aqui está a documentação atualizada com o novo nome **Daia** aplicado de forma consistente em todo o conteúdo:

---

# **🧠 AI-Ready UX Product Documentation (Updated)**

---

# **1\. 🧩 Product Overview**

**Product Name:** Daia

**One-liner:**  
We help diabetics calculate the correct insulin dosage by instantly analyzing the glucose impact of their meals using AI (image, audio, or manual input).

---

### **Problem Statement**

Most diabetics struggle to calculate the correct insulin dosage before meals due to uncertainty about carbohydrate intake, portion sizes, and meal composition. This leads to dangerous glucose spikes (hyperglycemia) or drops (hypoglycemia), increasing health risks and cognitive burden.

---

### **Value Proposition**

Use AI to analyze food (via camera, audio, or manual input) and recommend precise insulin dosage based on carbs and current glucose level in seconds.

---

### **Success Metrics (KPIs)**

* % of meals logged with insulin recommendation  
* Reduction in glucose variability (with CGM integration)  
* Daily active usage before meals  
* Recommendation acceptance rate  
* Time to log meal (\<30s goal)

---

# **2\. 🎯 Target Users & Context**

### **Primary Persona**

* Adults (18–55) with Type 1 or insulin-dependent Type 2 diabetes  
* Medium/high digital maturity

---

### **Goals**

* Avoid glucose spikes/drops  
* Simplify insulin calculation  
* Reduce anxiety around eating

---

### **Frustrations**

* Carb counting is complex  
* Fear of incorrect insulin dosage  
* Time pressure before meals

---

### **Usage Context**

* Platform: Mobile app  
* When: 1–3 minutes before meals  
* Environment: Anywhere

---

### **Edge Users**

* Parents managing children  
* Elderly users (simplified UI needed)

---

# **3\. 🧭 Core User Flows**

---

## **Flow 1: Meal Scan & Insulin Recommendation**

**Entry:** “Scan Meal”

**Steps:**

1. User scans food, uploads image, or sends audio  
2. AI processes input (image/audio/text)  
3. Detects food and estimates carbs  
4. User confirms or edits  
5. User inputs current glucose  
6. App calculates insulin dose  
7. User confirms

---

## **Flow 2: Manual Entry**

**Steps:**

1. Search/select foods  
2. Input quantity  
3. View carb estimation  
4. Input current glucose  
5. Receive insulin recommendation

---

## **Flow 3: History & Insights**

* View past meals  
* Analyze glucose patterns  
* Review insulin decisions

---

## **Flow 4: Audio Meal Input**

**Entry:** “Describe Meal”

**Steps:**

1. Record/send audio  
2. AI transcribes speech  
3. AI interprets foods and portions  
4. Show editable structure  
5. User confirms  
6. Continue to glucose input → insulin calculation

---

# **4\. 🧱 Feature Breakdown**

---

## **Feature: AI Meal Recognition**

* Input: image  
* Output: detected food \+ carbs

---

## **Feature: Audio Meal Recognition**

* Input: voice  
* Output: structured meal via NLP

---

## **Feature: Insulin Calculator**

**Inputs:**

* Carbs  
* Current glucose  
* User profile

**Outputs:**

* Meal bolus  
* Correction bolus  
* Total dose

---

## **Feature: User Profile**

* Insulin ratio  
* Correction factor  
* Target glucose

---

## **Feature: Meal History**

* Logs meals \+ insulin  
* Enables insights

---

# **5\. 📜 Business Rules**

* Insulin recommendation must always be editable  
* Display disclaimer: “This is a support tool, not medical advice”  
* User must configure profile before usage

---

### **Rules**

* Glucose input required for full recommendation  
* Allow skip with warning (no correction dose)  
* Always separate:  
  * Meal bolus  
  * Correction bolus

---

### **AI Rules**

* Confidence score required  
* Low confidence → force confirmation  
* Audio always requires validation

---

# **6\. 🧮 Data Model**

---

## **Entity: User**

* id  
* insulin\_ratio  
* correction\_factor  
* target\_glucose

---

## **Entity: Meal**

* id  
* datetime  
* items  
* total\_carbs  
* input\_method (image | manual | audio)  
* audio\_transcript (optional)

---

## **Entity: FoodItem**

* name  
* carbs  
* quantity

---

## **Entity: InsulinRecommendation**

* total\_dose  
* meal\_bolus  
* correction\_bolus  
* confidence  
* explanation

---

## **Entity: GlucoseReading**

* value  
* source (manual | CGM)  
* timestamp

---

# **7\. ✍️ Content & Microcopy**

Tone: Friendly but safe

---

### **Examples**

**Primary CTA:**  
“Calculate Dose”

**Warning:**  
“Current glucose not provided — correction not included”

**Error:**  
“Something’s off. Let’s review before calculating.”

---

# **8\. 🎨 Design Constraints**

* Platform: Mobile  
* UI: Material UI 3  
* Colors: Blue-based healthcare palette  
* Typography: Roboto  
* Accessibility: WCAG AA

---

# **9\. 🧩 Components & Patterns**

* Bottom tab navigation  
* Step-by-step flow  
* Card-based UI  
* Large dosage display

---

# **10\. ⚠️ Edge Cases & States**

* No meals logged  
* AI processing delay  
* AI failure  
* Low-quality audio input  
* Missing glucose input  
* Outdated glucose data

---

# **11\. 🚀 Scope & Prioritization**

---

## **MVP**

* Image meal scan  
* Manual entry  
* Audio input (basic)  
* Manual glucose input  
* Insulin recommendation  
* Basic history

---

## **Future**

* CGM integration  
* Smart notifications  
* Predictive alerts  
* Doctor reports

---

# **12\. ❌ Anti-Requirements**

* No full automation  
* No auto-injection implication  
* No complex medical dashboards  
* No humor in critical moments

---

# **13\. 🤖 AI Generation Instructions**

---

### **Screens**

* Dashboard  
* Meal scan  
* Manual entry  
* Audio input flow  
* Glucose input screen  
* Insulin result screen (with breakdown)  
* History

---

### **Constraints**

* ≤30s flow  
* Show confidence  
* High contrast  
* Clear decision hierarchy

---

# **🧬 Clinical-Grade Logic**

---

## **Insulin Types Supported**

* Rapid-acting  
* Short-acting  
* Long-acting  
* Ultra-long

---

## **Core Concepts**

* Insulin-to-Carb Ratio (ICR)  
* Correction Factor (CF)  
* Target Glucose  
* Insulin on Board (IOB)

---

## **🧮 Calculation Logic**

Meal Bolus:  
dose\_meal \= total\_carbs / insulin\_ratio

Correction Bolus:  
dose\_correction \= (current\_glucose \- target\_glucose) / correction\_factor

Total Dose:  
total\_dose \= dose\_meal \+ dose\_correction \- insulin\_on\_board

---

## **⚠️ Safety Constraints**

* Never recommend negative insulin  
* Require glucose for correction  
* Highlight risks:  
  * 250 → hyperglycemia  
  * \<70 → hypoglycemia

---

## **⏱ Timing Logic**

* Rapid: 10–15 min before  
* Short: 20–30 min before

Adjust based on:

* Glucose  
* Meal composition

---

## **🍽 Meal Adjustments**

* High fat → split bolus  
* High protein → delayed warning

---

## **🧠 AI Explainability**

* Show confidence  
* Show breakdown:  
  * “X units (carbs) \+ Y units (correction)”

---

## **🚨 Critical UX Rules**

* Always allow manual override  
* Require confirmation before dose  
* Never imply automation  
* Highlight dose clearly

---

# **✅ Final Checklist**

* Multimodal input (image \+ audio \+ manual)  
* Glucose-aware insulin calculation  
* Clinical logic implemented  
* Safety rules defined  
* AI explainability included  
* Ready for AI UI generation

---

Se quiser, posso converter isso em **PDF pronto para apresentação** ou em **versão enxuta estilo pitch deck para investidores** — isso aqui já está num nível bem profissional.

