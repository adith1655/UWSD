export const mockUsers = [
  { id: "u1", name: "Aarav Sharma", email: "aarav@muj.edu", role: "student", room: "B-204", photo: null, isActive: true },
  { id: "u2", name: "Priya Patel", email: "priya@muj.edu", role: "student", room: "G-112", photo: null, isActive: true },
  { id: "u3", name: "Rahul Verma", email: "rahul@muj.edu", role: "student", room: "B-305", photo: null, isActive: true },
  { id: "u4", name: "Sneha Gupta", email: "sneha@muj.edu", role: "student", room: "G-208", photo: null, isActive: true },
  { id: "u5", name: "Vikram Singh", email: "vikram@muj.edu", role: "guard", room: null, photo: null, isActive: true },
  { id: "u6", name: "Dr. Meera Joshi", email: "meera@muj.edu", role: "warden", room: null, photo: null, isActive: true },
  { id: "u7", name: "Amit Kumar", email: "amit@muj.edu", role: "admin", room: null, photo: null, isActive: true },
  { id: "u8", name: "Kavya Nair", email: "kavya@muj.edu", role: "student", room: "G-301", photo: null, isActive: true },
  { id: "u9", name: "Rohan Das", email: "rohan@muj.edu", role: "student", room: "B-102", photo: null, isActive: false },
  { id: "u10", name: "Ananya Reddy", email: "ananya@muj.edu", role: "student", room: "G-205", photo: null, isActive: true },
  { id: "u11", name: "Suresh Babu", email: "suresh@muj.edu", role: "guard", room: null, photo: null, isActive: true },
  { id: "u12", name: "Dr. Rakesh Tiwari", email: "rakesh@muj.edu", role: "warden", room: null, photo: null, isActive: true },
];

export const mockCameras = [
  { id: "c1", name: "Main Gate - Entry", location: "Main Gate", status: "ONLINE", lastSeen: new Date() },
  { id: "c2", name: "Main Gate - Exit", location: "Main Gate", status: "ONLINE", lastSeen: new Date() },
  { id: "c3", name: "Hostel B - Lobby", location: "Boys Hostel B", status: "ONLINE", lastSeen: new Date() },
  { id: "c4", name: "Hostel G - Lobby", location: "Girls Hostel G", status: "ONLINE", lastSeen: new Date() },
  { id: "c5", name: "Parking Lot A", location: "North Parking", status: "ONLINE", lastSeen: new Date() },
  { id: "c6", name: "Library Entrance", location: "Central Library", status: "OFFLINE", lastSeen: new Date(Date.now() - 3600000) },
  { id: "c7", name: "Canteen Area", location: "Food Court", status: "ONLINE", lastSeen: new Date() },
  { id: "c8", name: "Academic Block", location: "Block A", status: "MAINTENANCE", lastSeen: new Date(Date.now() - 7200000) },
  { id: "c9", name: "Sports Complex", location: "Sports Block", status: "ONLINE", lastSeen: new Date() },
];

export const mockAlerts = [
  { id: "a1", level: "RED", type: "UNAUTHORIZED_ENTRY", message: "Unrecognized face detected at Main Gate after hours", cameraId: "c1", sourceUserId: null, acknowledgedBy: null, createdAt: new Date(Date.now() - 120000) },
  { id: "a2", level: "YELLOW", type: "UNREGISTERED_VISITOR", message: "Unregistered visitor detected at Hostel B lobby", cameraId: "c3", sourceUserId: null, acknowledgedBy: "u5", createdAt: new Date(Date.now() - 300000) },
  { id: "a3", level: "RED", type: "NIGHT_OUT_VIOLATION", message: "Aarav Sharma attempting entry without approved night-out pass", cameraId: "c1", sourceUserId: "u1", acknowledgedBy: null, createdAt: new Date(Date.now() - 600000) },
  { id: "a4", level: "GREEN", type: "AUTHORIZED_ACCESS", message: "Priya Patel verified and granted entry", cameraId: "c4", sourceUserId: "u2", acknowledgedBy: null, createdAt: new Date(Date.now() - 900000) },
  { id: "a5", level: "YELLOW", type: "VEHICLE_OVERSTAY", message: "Unregistered vehicle (RJ14 CA 7742) parked over 2 hours", cameraId: "c5", sourceUserId: null, acknowledgedBy: null, createdAt: new Date(Date.now() - 1800000) },
  { id: "a6", level: "RED", type: "CAMERA_OFFLINE", message: "Library Entrance camera offline for 1+ hour", cameraId: "c6", sourceUserId: null, acknowledgedBy: "u5", createdAt: new Date(Date.now() - 3600000) },
  { id: "a7", level: "GREEN", type: "AUTHORIZED_ACCESS", message: "Rahul Verma verified and granted entry", cameraId: "c3", sourceUserId: "u3", acknowledgedBy: null, createdAt: new Date(Date.now() - 4200000) },
  { id: "a8", level: "YELLOW", type: "PARCEL_UNCLAIMED", message: "Parcel for Kavya Nair unclaimed for 48+ hours", cameraId: null, sourceUserId: "u8", acknowledgedBy: null, createdAt: new Date(Date.now() - 7200000) },
  { id: "a9", level: "GREEN", type: "AUTHORIZED_ACCESS", message: "Sneha Gupta verified and granted entry", cameraId: "c4", sourceUserId: "u4", acknowledgedBy: null, createdAt: new Date(Date.now() - 10800000) },
  { id: "a10", level: "RED", type: "UNAUTHORIZED_ENTRY", message: "Unknown person detected near Hostel G after 11 PM", cameraId: "c4", sourceUserId: null, acknowledgedBy: "u5", createdAt: new Date(Date.now() - 14400000) },
];

export const mockVisitors = [
  { id: "v1", name: "Ramesh Sharma", phone: "+91 98765 43210", purpose: "Parent visit", hostUserId: "u1", hostName: "Aarav Sharma", status: "CHECKED_IN", allowedZones: ["Lobby", "Canteen"], passToken: "VIS-20260328-001", checkedInAt: new Date(Date.now() - 1800000), checkedOutAt: null, createdAt: new Date(Date.now() - 3600000), hasFace: true, qrToken: "VIS-20260328-001", timeStart: new Date(Date.now() - 7200000).toISOString(), timeEnd: new Date(Date.now() + 14400000).toISOString() },
  { id: "v2", name: "Sunita Patel", phone: "+91 87654 32109", purpose: "Parent visit", hostUserId: "u2", hostName: "Priya Patel", status: "PRE_APPROVED", allowedZones: ["Lobby"], passToken: null, checkedInAt: null, checkedOutAt: null, createdAt: new Date(Date.now() - 1200000), hasFace: true, qrToken: "VIS-20260409-A2B", timeStart: new Date(Date.now() - 3600000).toISOString(), timeEnd: new Date(Date.now() + 21600000).toISOString() },
  { id: "v3", name: "Delivery Agent (Amazon)", phone: "+91 76543 21098", purpose: "Parcel delivery", hostUserId: null, hostName: null, status: "CHECKED_OUT", allowedZones: ["Front Desk"], passToken: "VIS-20260328-002", checkedInAt: new Date(Date.now() - 7200000), checkedOutAt: new Date(Date.now() - 6600000), createdAt: new Date(Date.now() - 7200000), hasFace: false, qrToken: null, timeStart: null, timeEnd: null },
  { id: "v4", name: "Prof. R.K. Mishra", phone: "+91 65432 10987", purpose: "Guest lecture", hostUserId: "u7", hostName: "Amit Kumar", status: "CHECKED_IN", allowedZones: ["Lobby", "Academic Block A", "Canteen"], passToken: "VIS-20260328-003", checkedInAt: new Date(Date.now() - 5400000), checkedOutAt: null, createdAt: new Date(Date.now() - 86400000), hasFace: true, qrToken: "VIS-20260328-003", timeStart: new Date(Date.now() - 10800000).toISOString(), timeEnd: new Date(Date.now() + 18000000).toISOString() },
  { id: "v5", name: "Unknown Visitor", phone: null, purpose: "Not specified", hostUserId: null, hostName: null, status: "BLACKLISTED", allowedZones: [], passToken: null, checkedInAt: null, checkedOutAt: null, createdAt: new Date(Date.now() - 172800000), hasFace: false, qrToken: null, timeStart: null, timeEnd: null },
];

export const mockNightOutRequests = [
  { id: "n1", studentId: "u1", studentName: "Aarav Sharma", room: "B-204", reason: "Family emergency", destination: "Jaipur, Home", leaveDate: "2026-03-28", returnDate: "2026-03-29", returnTime: "18:00", status: "PENDING", approvedBy: null, createdAt: new Date(Date.now() - 3600000) },
  { id: "n2", studentId: "u2", studentName: "Priya Patel", room: "G-112", reason: "Medical appointment", destination: "Jaipur City Hospital", leaveDate: "2026-03-29", returnDate: "2026-03-29", returnTime: "14:00", status: "APPROVED", approvedBy: "Dr. Meera Joshi", createdAt: new Date(Date.now() - 7200000) },
  { id: "n3", studentId: "u3", studentName: "Rahul Verma", room: "B-305", reason: "Weekend trip", destination: "Pushkar", leaveDate: "2026-03-28", returnDate: "2026-03-30", returnTime: "20:00", status: "APPROVED", approvedBy: "Dr. Meera Joshi", createdAt: new Date(Date.now() - 86400000) },
  { id: "n4", studentId: "u4", studentName: "Sneha Gupta", room: "G-208", reason: "Cousin's wedding", destination: "Delhi", leaveDate: "2026-03-27", returnDate: "2026-03-28", returnTime: "22:00", status: "OVERDUE", approvedBy: "Dr. Meera Joshi", createdAt: new Date(Date.now() - 172800000) },
  { id: "n5", studentId: "u8", studentName: "Kavya Nair", room: "G-301", reason: "Personal reasons", destination: "Jaipur", leaveDate: "2026-03-28", returnDate: "2026-03-28", returnTime: "21:00", status: "REJECTED", approvedBy: "Dr. Meera Joshi", createdAt: new Date(Date.now() - 14400000) },
  { id: "n6", studentId: "u10", studentName: "Ananya Reddy", room: "G-205", reason: "Internship interview", destination: "Bangalore (online from cafe)", leaveDate: "2026-03-29", returnDate: "2026-03-29", returnTime: "16:00", status: "PENDING", approvedBy: null, createdAt: new Date(Date.now() - 1800000) },
];

export const mockParcels = [
  { id: "p1", tracking_id: "FK-2026032801",  student_id: "u1",  recipientName: "Aarav Sharma",  room: "B-204", courierName: "Flipkart",  loggedBy: "Vikram Singh", status: "pending",   timestamp: new Date(Date.now() - 3600000),    deliveredAt: null },
  { id: "p2", tracking_id: "AMZ-2026032802", student_id: "u2",  recipientName: "Priya Patel",   room: "G-112", courierName: "Amazon",    loggedBy: "Vikram Singh", status: "pending",   timestamp: new Date(Date.now() - 7200000),    deliveredAt: null },
  { id: "p3", tracking_id: "MSH-2026032701", student_id: "u3",  recipientName: "Rahul Verma",   room: "B-305", courierName: "Meesho",    loggedBy: "Suresh Babu",  status: "delivered", timestamp: new Date(Date.now() - 86400000),   deliveredAt: new Date(Date.now() - 43200000) },
  { id: "p4", tracking_id: "MYN-2026032601", student_id: "u8",  recipientName: "Kavya Nair",    room: "G-301", courierName: "Myntra",    loggedBy: "Vikram Singh", status: "pending",   timestamp: new Date(Date.now() - 172800000),  deliveredAt: null },
  { id: "p5", tracking_id: "DLV-2026032803", student_id: "u4",  recipientName: "Sneha Gupta",   room: "G-208", courierName: "Delhivery", loggedBy: "Suresh Babu",  status: "pending",   timestamp: new Date(Date.now() - 1800000),    deliveredAt: null },
  { id: "p6", tracking_id: "BD-2026032804",  student_id: "u10", recipientName: "Ananya Reddy",  room: "G-205", courierName: "BlueDart",  loggedBy: "Vikram Singh", status: "delivered", timestamp: new Date(Date.now() - 259200000),  deliveredAt: new Date(Date.now() - 216000000) },
];

export const mockVehicles = [
  { id: "ve1", licensePlate: "RJ14 CA 7742", ownerName: "Unknown", vehicleType: "Car", isRegistered: false, status: "PARKED", entryTime: new Date(Date.now() - 7200000), exitTime: null },
  { id: "ve2", licensePlate: "RJ14 AB 1234", ownerName: "Dr. Rakesh Tiwari", vehicleType: "Car", isRegistered: true, status: "PARKED", entryTime: new Date(Date.now() - 3600000), exitTime: null },
  { id: "ve3", licensePlate: "RJ14 CD 5678", ownerName: "Amit Kumar", vehicleType: "Motorcycle", isRegistered: true, status: "PARKED", entryTime: new Date(Date.now() - 1800000), exitTime: null },
  { id: "ve4", licensePlate: "DL01 BC 9012", ownerName: "Visitor - Prof. Mishra", vehicleType: "Car", isRegistered: false, status: "PARKED", entryTime: new Date(Date.now() - 5400000), exitTime: null },
  { id: "ve5", licensePlate: "RJ14 EF 3456", ownerName: "Priya Patel", vehicleType: "Scooter", isRegistered: true, status: "EXITED", entryTime: new Date(Date.now() - 28800000), exitTime: new Date(Date.now() - 7200000) },
  { id: "ve6", licensePlate: "RJ27 GH 7890", ownerName: "Unknown", vehicleType: "Truck", isRegistered: false, status: "EXITED", entryTime: new Date(Date.now() - 14400000), exitTime: new Date(Date.now() - 10800000) },
];

export const mockAccessLogs = [
  { id: "l1", userName: "Aarav Sharma", eventType: "ENTRY", confidence: 0.94, threatLevel: "GREEN", cameraName: "Main Gate - Entry", createdAt: new Date(Date.now() - 900000) },
  { id: "l2", userName: "Priya Patel", eventType: "ENTRY", confidence: 0.97, threatLevel: "GREEN", cameraName: "Hostel G - Lobby", createdAt: new Date(Date.now() - 1800000) },
  { id: "l3", userName: "Unknown", eventType: "DENIED", confidence: 0.32, threatLevel: "RED", cameraName: "Main Gate - Entry", createdAt: new Date(Date.now() - 2700000) },
  { id: "l4", userName: "Rahul Verma", eventType: "EXIT", confidence: 0.91, threatLevel: "GREEN", cameraName: "Main Gate - Exit", createdAt: new Date(Date.now() - 3600000) },
  { id: "l5", userName: "Sneha Gupta", eventType: "ENTRY", confidence: 0.89, threatLevel: "GREEN", cameraName: "Hostel G - Lobby", createdAt: new Date(Date.now() - 5400000) },
  { id: "l6", userName: "Unknown Visitor", eventType: "ENTRY", confidence: 0.0, threatLevel: "YELLOW", cameraName: "Main Gate - Entry", createdAt: new Date(Date.now() - 7200000) },
  { id: "l7", userName: "Kavya Nair", eventType: "EXIT", confidence: 0.95, threatLevel: "GREEN", cameraName: "Hostel G - Lobby", createdAt: new Date(Date.now() - 10800000) },
  { id: "l8", userName: "Rohan Das", eventType: "DENIED", confidence: 0.88, threatLevel: "RED", cameraName: "Hostel B - Lobby", createdAt: new Date(Date.now() - 14400000) },
];

export const mockDashboardStats = {
  totalEntriesToday: 347,
  activeAlerts: 3,
  camerasOnline: 7,
  camerasTotal: 9,
  nightOutActive: 2,
  parcelsUnclaimed: 3,
  visitorsOnCampus: 2,
  unauthorizedAttempts: 2,
};

export const mockHourlyTraffic = [
  { hour: "6AM", entries: 12, exits: 3 },
  { hour: "7AM", entries: 45, exits: 8 },
  { hour: "8AM", entries: 89, exits: 15 },
  { hour: "9AM", entries: 67, exits: 22 },
  { hour: "10AM", entries: 34, exits: 28 },
  { hour: "11AM", entries: 23, exits: 19 },
  { hour: "12PM", entries: 18, exits: 31 },
  { hour: "1PM", entries: 29, exits: 25 },
  { hour: "2PM", entries: 41, exits: 17 },
  { hour: "3PM", entries: 22, exits: 34 },
  { hour: "4PM", entries: 15, exits: 52 },
  { hour: "5PM", entries: 11, exits: 67 },
  { hour: "6PM", entries: 8, exits: 45 },
  { hour: "7PM", entries: 19, exits: 12 },
  { hour: "8PM", entries: 14, exits: 8 },
  { hour: "9PM", entries: 7, exits: 5 },
  { hour: "10PM", entries: 3, exits: 2 },
  { hour: "11PM", entries: 1, exits: 1 },
];

export const mockWeeklyAlerts = [
  { day: "Mon", red: 2, yellow: 5, green: 87 },
  { day: "Tue", red: 1, yellow: 3, green: 92 },
  { day: "Wed", red: 0, yellow: 4, green: 95 },
  { day: "Thu", red: 3, yellow: 6, green: 78 },
  { day: "Fri", red: 1, yellow: 8, green: 105 },
  { day: "Sat", red: 4, yellow: 2, green: 45 },
  { day: "Sun", red: 2, yellow: 1, green: 32 },
];
