/**
 * MedSage AI - Demo Data
 * 
 * NOTE FOR BEGINNERS:
 * In a full-stack production application, this information would be retrieved
 * from a secure database via an API. For now, we store realistic sample data
 * locally in this file so we can build and test our user interface immediately.
 * 
 * DISCLAIMER:
 * This data is strictly for demonstration purposes. It does not constitute medical
 * advice, diagnoses, or prescriptions.
 */

export const patientProfile = {
  name: "Sarah Jenkins",
  id: "MED-88492",
  age: 48,
  caretaker: "David Jenkins (Spouse)",
  primaryPhysician: "Dr. Evelyn Reed, MD",
  allergies: ["Penicillin", "Sulfa drugs"],
  bloodGroup: "A+",
  adherenceRate: 94, // Percentage of doses taken on time over last 30 days
};

export const dashboardMetrics = {
  totalPrescriptions: 5,
  activePrescriptions: 5,
  upcomingDosesToday: 2,
  dosesTakenToday: 3,
  dosesMissedToday: 0,
  totalDosesToday: 5,
  lowStockItemsCount: 2,
};

export const initialSchedule = [
  {
    id: "dose-1",
    time: "08:00 AM",
    timePeriod: "Morning",
    medicineName: "Metformin HCl",
    dosage: "500 mg",
    form: "Tablet",
    instruction: "Take with breakfast",
    status: "taken", // 'taken', 'due-soon', 'upcoming', 'missed'
    doctor: "Dr. Evelyn Reed",
    prescribedFor: "Blood Sugar Support",
  },
  {
    id: "dose-2",
    time: "08:00 AM",
    timePeriod: "Morning",
    medicineName: "Lisinopril",
    dosage: "10 mg",
    form: "Tablet",
    instruction: "Take with a glass of water",
    status: "taken",
    doctor: "Dr. Evelyn Reed",
    prescribedFor: "Cardiovascular Health",
  },
  {
    id: "dose-3",
    time: "01:00 PM",
    timePeriod: "Afternoon",
    medicineName: "Vitamin D3",
    dosage: "1,000 IU",
    form: "Softgel",
    instruction: "Take with meal",
    status: "taken",
    doctor: "Dr. Evelyn Reed",
    prescribedFor: "Bone & Immune Support",
  },
  {
    id: "dose-4",
    time: "07:30 PM",
    timePeriod: "Evening",
    medicineName: "Metformin HCl",
    dosage: "500 mg",
    form: "Tablet",
    instruction: "Take with dinner",
    status: "due-soon",
    doctor: "Dr. Evelyn Reed",
    prescribedFor: "Blood Sugar Support",
  },
  {
    id: "dose-5",
    time: "09:30 PM",
    timePeriod: "Night",
    medicineName: "Atorvastatin",
    dosage: "20 mg",
    form: "Tablet",
    instruction: "Take before bedtime",
    status: "upcoming",
    doctor: "Dr. Marcus Vance",
    prescribedFor: "Lipid Management",
  },
];

export const lowStockMedications = [
  {
    id: "stock-1",
    medicineName: "Lisinopril",
    dosage: "10 mg",
    remainingUnits: 4,
    unitType: "tablets",
    daysRemaining: 2,
    threshold: 7,
    pharmacy: "HealthFirst Care Pharmacy",
    refillRxNumber: "RX-49102-A",
  },
  {
    id: "stock-2",
    medicineName: "Atorvastatin",
    dosage: "20 mg",
    remainingUnits: 6,
    unitType: "tablets",
    daysRemaining: 3,
    threshold: 7,
    pharmacy: "Civic Wellness Pharmacy",
    refillRxNumber: "RX-77201-B",
  },
];

export const recentActivities = [
  {
    id: "act-1",
    type: "dose_taken",
    title: "Afternoon Dose Confirmed",
    description: "Marked Vitamin D3 (1,000 IU) as taken at 1:12 PM.",
    timeAgo: "2 hours ago",
    badge: "Logged",
    badgeType: "success",
  },
  {
    id: "act-2",
    type: "prescription_renewed",
    title: "Prescription Renewed",
    description: "Dr. Evelyn Reed authorized a 90-day refill for Metformin HCl.",
    timeAgo: "Yesterday at 4:30 PM",
    badge: "Rx Updated",
    badgeType: "info",
  },
  {
    id: "act-3",
    type: "stock_warning",
    title: "Low Stock Alert Generated",
    description: "Lisinopril has reached 4 tablets remaining (2 days supply).",
    timeAgo: "Yesterday at 9:00 AM",
    badge: "Low Stock",
    badgeType: "warning",
  },
  {
    id: "act-4",
    type: "caretaker_view",
    title: "Caretaker Sync Completed",
    description: "David Jenkins reviewed the morning medication log.",
    timeAgo: "2 days ago",
    badge: "Caretaker",
    badgeType: "neutral",
  },
];

export const navItems = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", badge: null },
  { id: "profile", label: "Patient Profile", icon: "user", badge: null },
  { id: "prescriptions", label: "My Prescriptions", icon: "prescriptions", badge: "5" },
  { id: "schedule", label: "Medicine Schedule", icon: "schedule", badge: null },
  { id: "stock", label: "Medicine Stock", icon: "stock", badge: "2 Low" },
  { id: "bill-checker", label: "Pharmacy Bill Checker", icon: "billChecker", badge: "AI" },
  { id: "ai-assistant", label: "AI Health Assistant", icon: "aiAssistant", badge: "New" },
  { id: "caretaker", label: "Caretaker", icon: "caretaker", badge: null },
  { id: "settings", label: "Settings", icon: "settings", badge: null },
];
