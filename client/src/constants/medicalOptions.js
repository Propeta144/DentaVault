// Mga pagpipilian sa Medical History at Allergies (dropdown sa PatientForm).
//
// Batay sa karaniwang medical history form ng dental clinic sa Pilipinas
// (PDA-style checklist) at sa mga kondisyong nakakaapekto sa dental
// treatment: pagdurugo (bunot), anesthesia at epinephrine (puso, BP,
// thyroid), antibiotic bago mag-treatment (heart valve, joint implant),
// paggaling ng sugat (diabetes, radiation, bisphosphonates), at
// infection control (hepatitis, TB, HIV).
//
// Hindi ito kumpletong listahan: puwede pa ring mag-type ng kahit ano sa
// field (free text). Ang `keywords` ay para mahanap din gamit ang ibang
// tawag (hal. "BP", "altapresyon", "highblood").
//
// Naka-save pa rin bilang comma-separated text (walang binago sa database),
// kaya iwasan ang comma sa loob ng label.

export const MEDICAL_HISTORY_OPTIONS = [
  {
    group: 'Heart and blood pressure',
    options: [
      { label: 'Hypertension (high blood pressure)', keywords: ['bp', 'highblood', 'high blood', 'altapresyon'] },
      { label: 'Low blood pressure', keywords: ['bp', 'lowblood', 'hypotension'] },
      { label: 'Heart disease', keywords: ['cardiac', 'puso'] },
      { label: 'Heart attack', keywords: ['myocardial infarction', 'mi', 'puso'] },
      { label: 'Heart surgery / Bypass', keywords: ['cardiac', 'puso'] },
      { label: 'Heart murmur', keywords: ['puso'] },
      { label: 'Artificial heart valve', keywords: ['prosthetic valve', 'puso'] },
      { label: 'Pacemaker', keywords: ['puso'] },
      { label: 'Chest pain / Angina', keywords: ['puso'] },
      { label: 'Rheumatic fever', keywords: ['rheumatic heart'] },
      { label: 'Stroke', keywords: ['cva', 'na-stroke'] },
      { label: 'Swollen ankles', keywords: ['edema', 'manas'] },
    ],
  },
  {
    group: 'Blood and bleeding',
    options: [
      { label: 'Bleeding problems', keywords: ['bleeding disorder', 'pagdurugo', 'dugo'] },
      { label: 'Taking blood thinners (Warfarin / Aspirin / Clopidogrel)', keywords: ['anticoagulant', 'antiplatelet'] },
      { label: 'Anemia', keywords: ['dugo', 'kulang sa dugo'] },
      { label: 'Hemophilia', keywords: ['bleeding', 'dugo'] },
      { label: 'Leukemia / Blood disease', keywords: ['dugo'] },
    ],
  },
  {
    group: 'Hormones and metabolism',
    options: [
      { label: 'Diabetes', keywords: ['sugar', 'diabetic', 'mataas ang sugar'] },
      { label: 'Thyroid problem', keywords: ['goiter', 'hyperthyroid', 'hypothyroid', 'bosyo'] },
      { label: 'Rapid weight loss', keywords: ['pumayat'] },
    ],
  },
  {
    group: 'Lungs and breathing',
    options: [
      { label: 'Asthma', keywords: ['hika'] },
      { label: 'Tuberculosis (TB)', keywords: ['tb', 'pkd', 'primary complex'] },
      { label: 'Emphysema / COPD', keywords: ['lungs', 'baga'] },
      { label: 'Respiratory problems', keywords: ['breathing', 'hirap huminga', 'baga', 'lungs'] },
      { label: 'Allergic rhinitis / Hay fever', keywords: ['sinus', 'sipon'] },
      { label: 'Sleep apnea', keywords: ['hilik', 'snoring'] },
      { label: 'Smoker', keywords: ['smoking', 'cigarette', 'vape', 'naninigarilyo'] },
    ],
  },
  {
    group: 'Infections',
    options: [
      { label: 'Hepatitis B', keywords: ['liver', 'atay', 'jaundice'] },
      { label: 'Hepatitis C', keywords: ['liver', 'atay', 'jaundice'] },
      { label: 'Liver disease', keywords: ['atay', 'cirrhosis', 'jaundice'] },
      { label: 'Jaundice', keywords: ['paninilaw', 'yellow skin', 'hepatitis', 'atay'] },
      { label: 'HIV / AIDS', keywords: ['immune'] },
      { label: 'Sexually transmitted disease', keywords: ['std', 'sti'] },
    ],
  },
  {
    group: 'Kidney and stomach',
    options: [
      { label: 'Kidney disease', keywords: ['bato', 'dialysis', 'renal'] },
      { label: 'Stomach ulcer / GERD', keywords: ['acid', 'hyperacidity', 'sikmura', 'ulcer'] },
    ],
  },
  {
    group: 'Brain and nerves',
    options: [
      { label: 'Epilepsy / Seizures', keywords: ['kombulsyon', 'convulsion', 'seizure'] },
      { label: 'Fainting spells', keywords: ['nahihimatay', 'syncope'] },
      { label: 'Head injury', keywords: ['ulo'] },
      { label: 'Anxiety / Dental fear', keywords: ['nervous', 'takot', 'phobia'] },
      { label: 'Psychiatric condition', keywords: ['depression', 'mental'] },
    ],
  },
  {
    group: 'Bones and joints',
    options: [
      { label: 'Arthritis / Rheumatism', keywords: ['rayuma', 'joint pain'] },
      { label: 'Osteoporosis', keywords: ['buto'] },
      { label: 'Taking bisphosphonates (osteoporosis medicine)', keywords: ['alendronate', 'fosamax', 'buto'] },
      { label: 'Joint replacement / Implant', keywords: ['hip', 'knee', 'tuhod'] },
    ],
  },
  {
    group: 'Cancer and treatment',
    options: [
      { label: 'Cancer / Tumor', keywords: ['bukol', 'kanser'] },
      { label: 'Radiation therapy (head or neck)', keywords: ['radiotherapy', 'cancer'] },
      { label: 'Chemotherapy', keywords: ['chemo', 'cancer'] },
    ],
  },
  {
    group: 'Pregnancy and women',
    options: [
      { label: 'Pregnant', keywords: ['buntis'] },
      { label: 'Breastfeeding', keywords: ['nagpapasuso', 'lactating'] },
      { label: 'Taking birth control pills', keywords: ['contraceptive', 'pills'] },
    ],
  },
  {
    group: 'Other',
    options: [
      { label: 'Recent surgery / Hospitalization', keywords: ['operation', 'opera', 'na-ospital'] },
      { label: 'Taking steroids', keywords: ['prednisone', 'corticosteroid'] },
      { label: 'Weak immune system', keywords: ['immunocompromised', 'transplant'] },
      { label: 'Alcohol use', keywords: ['drinker', 'umiinom', 'alak'] },
    ],
  },
]

export const ALLERGY_OPTIONS = [
  {
    group: 'Antibiotics',
    options: [
      { label: 'Penicillin', keywords: ['antibiotic'] },
      { label: 'Amoxicillin', keywords: ['antibiotic', 'penicillin', 'co-amoxiclav'] },
      { label: 'Cephalosporins (e.g. Cefalexin)', keywords: ['antibiotic', 'cefuroxime', 'cefaclor'] },
      { label: 'Sulfa drugs', keywords: ['antibiotic', 'sulfonamide', 'cotrimoxazole'] },
      { label: 'Clindamycin', keywords: ['antibiotic'] },
      { label: 'Erythromycin / Azithromycin', keywords: ['antibiotic', 'macrolide'] },
      { label: 'Tetracycline / Doxycycline', keywords: ['antibiotic'] },
      { label: 'Metronidazole', keywords: ['antibiotic', 'flagyl'] },
    ],
  },
  {
    group: 'Pain relievers',
    options: [
      { label: 'Aspirin', keywords: ['pain', 'nsaid'] },
      { label: 'Ibuprofen / NSAIDs', keywords: ['pain', 'advil', 'nsaid'] },
      { label: 'Mefenamic acid', keywords: ['pain', 'ponstan', 'dolfenal', 'nsaid'] },
      { label: 'Paracetamol', keywords: ['pain', 'biogesic', 'acetaminophen'] },
      { label: 'Codeine / Tramadol', keywords: ['pain', 'opioid'] },
    ],
  },
  {
    group: 'Anesthesia',
    options: [
      { label: 'Local anesthetic (Lidocaine)', keywords: ['anesthesia', 'lidocaine', 'xylocaine', 'injection'] },
      { label: 'Local anesthetic (Articaine / Mepivacaine)', keywords: ['anesthesia', 'injection'] },
      { label: 'Topical anesthetic (Benzocaine)', keywords: ['anesthesia', 'numbing gel'] },
      { label: 'Sulfites (preservative in anesthetic)', keywords: ['epinephrine', 'anesthesia'] },
    ],
  },
  {
    group: 'Dental materials',
    options: [
      { label: 'Latex', keywords: ['gloves', 'rubber'] },
      { label: 'Nickel / Metal', keywords: ['braces', 'crown', 'metal'] },
      { label: 'Acrylic (denture material)', keywords: ['denture', 'methyl methacrylate', 'pustiso'] },
      { label: 'Resin / Composite', keywords: ['filling', 'methacrylate', 'bonding'] },
      { label: 'Eugenol / Clove oil', keywords: ['temporary filling'] },
      { label: 'Chlorhexidine (mouthwash)', keywords: ['mouthwash', 'gargle'] },
      { label: 'Iodine / Povidone-iodine', keywords: ['betadine', 'antiseptic'] },
    ],
  },
  {
    group: 'Food and other',
    options: [
      { label: 'Seafood / Shellfish', keywords: ['shrimp', 'hipon', 'crab', 'alimango'] },
      { label: 'Peanuts / Nuts', keywords: ['mani'] },
      { label: 'Eggs', keywords: ['itlog'] },
      { label: 'Dust / Pollen', keywords: ['alikabok'] },
    ],
  },
]
