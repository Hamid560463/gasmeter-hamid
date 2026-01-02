import { Industry, User } from "./types";

export const INITIAL_INDUSTRIES: Industry[] = [
  {
    id: "IND-001",
    name: "فولاد مرکزی",
    subscriptionId: "98765432",
    city: "اصفهان",
    address: "شهرک صنعتی جی، خیابان سوم",
    allowedDailyConsumption: 5000,
    meters: [
      { id: "M-01", serialNumber: "SN-1001", name: "خط تولید ۱" },
      { id: "M-02", serialNumber: "SN-1002", name: "موتورخانه" }
    ]
  },
  {
    id: "IND-002",
    name: "سرامیک البرز",
    subscriptionId: "12345678",
    city: "کرج",
    address: "کیلومتر ۱۰ جاده مخصوص",
    allowedDailyConsumption: 2500,
    meters: [
      { id: "M-03", serialNumber: "SN-2005", name: "کوره اصلی" }
    ]
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: "USR-ADMIN",
    username: "admin",
    password: "admin", // In a real app, hash this!
    fullName: "مدیر سیستم",
    role: "admin"
  }
];