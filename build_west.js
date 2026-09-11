const fs = require('fs');
const path = require('path');

const CITIES = [
  // ── GUJARAT (40 cities & destinations) ──
  { name: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714, type: "Metro Hub" },
  { name: "Surat", state: "Gujarat", lat: 21.1702, lng: 72.8311, type: "Diamond/Textile Hub" },
  { name: "Vadodara", state: "Gujarat", lat: 22.3072, lng: 73.1812, type: "Cultural Capital" },
  { name: "Rajkot", state: "Gujarat", lat: 22.3039, lng: 70.8022, type: "Saurashtra Hub" },
  { name: "Gandhinagar", state: "Gujarat", lat: 23.2156, lng: 72.6369, type: "State Capital" },
  { name: "Bhavnagar", state: "Gujarat", lat: 21.7645, lng: 72.1519, type: "Port City" },
  { name: "Jamnagar", state: "Gujarat", lat: 22.4707, lng: 70.0577, type: "Oil City" },
  { name: "Junagadh", state: "Gujarat", lat: 21.5222, lng: 70.4579, type: "Heritage/Girnar" },
  { name: "Gandhidham", state: "Gujarat", lat: 23.0753, lng: 70.1337, type: "Kutch Hub" },
  { name: "Bhuj", state: "Gujarat", lat: 23.2420, lng: 69.6669, type: "Kutch Desert Gate" },
  { name: "Anand", state: "Gujarat", lat: 22.5645, lng: 72.9289, type: "Milk Capital" },
  { name: "Nadiad", state: "Gujarat", lat: 22.6916, lng: 72.8634, type: "Commercial City" },
  { name: "Bharuch", state: "Gujarat", lat: 21.7051, lng: 72.9959, type: "Industrial Hub" },
  { name: "Ankleshwar", state: "Gujarat", lat: 21.6264, lng: 73.0033, type: "Chemical Hub" },
  { name: "Navsari", state: "Gujarat", lat: 20.9507, lng: 72.9328, type: "Twin City of Surat" },
  { name: "Vapi", state: "Gujarat", lat: 20.3713, lng: 72.9048, type: "Industrial Gateway" },
  { name: "Valsad", state: "Gujarat", lat: 20.5992, lng: 72.9342, type: "Coastal City" },
  { name: "Porbandar", state: "Gujarat", lat: 21.6417, lng: 69.6293, type: "Birthplace of Gandhi" },
  { name: "Morbi", state: "Gujarat", lat: 22.8173, lng: 70.8377, type: "Ceramic Capital" },
  { name: "Surendranagar", state: "Gujarat", lat: 22.7278, lng: 71.6370, type: "Cotton City" },
  { name: "Mehsana", state: "Gujarat", lat: 23.5880, lng: 72.3693, type: "North Gujarat Hub" },
  { name: "Palanpur", state: "Gujarat", lat: 24.1724, lng: 72.4346, type: "Banaskantha Gateway" },
  { name: "Patan", state: "Gujarat", lat: 23.8493, lng: 72.1266, type: "Rani ki Vav Heritage" },
  { name: "Himatnagar", state: "Gujarat", lat: 23.5977, lng: 72.9698, type: "Sabarkantha Hub" },
  { name: "Somnath", state: "Gujarat", lat: 20.8880, lng: 70.4012, type: "Jyotirlinga Pilgrimage" },
  { name: "Dwarka", state: "Gujarat", lat: 22.2442, lng: 68.9685, type: "Char Dham Pilgrimage" },
  { name: "Sasan Gir", state: "Gujarat", lat: 21.1243, lng: 70.8242, type: "Asiatic Lion Sanctuary" },
  { name: "Mandvi", state: "Gujarat", lat: 22.8336, lng: 69.3558, type: "Kutch Beach Resort" },
  { name: "Daman", state: "Gujarat / UT", lat: 20.3974, lng: 72.8328, type: "Coastal Beach Gateway" },
  { name: "Diu", state: "Gujarat / UT", lat: 20.7144, lng: 70.9874, type: "Island Beach Resort" },
  { name: "Silvassa", state: "Gujarat / UT", lat: 20.2763, lng: 73.0083, type: "Dadra & Nagar Haveli" },
  { name: "Saputara", state: "Gujarat", lat: 20.5796, lng: 73.7497, type: "Hill Station (Dang)" },
  { name: "Kevadia (Statue of Unity)", state: "Gujarat", lat: 21.8380, lng: 73.7191, type: "World's Tallest Statue" },
  { name: "Champaner / Pavagadh", state: "Gujarat", lat: 22.4842, lng: 73.5350, type: "UNESCO Heritage Hill" },
  { name: "Ambaji", state: "Gujarat", lat: 24.3315, lng: 72.8504, type: "Shakti Peeth Pilgrimage" },
  { name: "Palitana", state: "Gujarat", lat: 21.5204, lng: 71.8286, type: "Shatrunjaya Jain Temples" },
  { name: "Modhera", state: "Gujarat", lat: 23.5835, lng: 72.1330, type: "Sun Temple Heritage" },
  { name: "Godhra", state: "Gujarat", lat: 22.7753, lng: 73.6149, type: "Panchmahal Hub" },
  { name: "Dahod", state: "Gujarat", lat: 22.8377, lng: 74.2546, type: "Eastern Gujarat Gateway" },
  { name: "Amreli", state: "Gujarat", lat: 21.6032, lng: 71.2221, type: "Saurashtra Agricultural City" },

  // ── MAHARASHTRA (45 cities & destinations) ──
  { name: "Mumbai", state: "Maharashtra", lat: 19.0760, lng: 72.8777, type: "Financial Capital" },
  { name: "Navi Mumbai", state: "Maharashtra", lat: 19.0330, lng: 73.0297, type: "Metro City" },
  { name: "Thane", state: "Maharashtra", lat: 19.2183, lng: 72.9781, type: "Lake City" },
  { name: "Kalyan-Dombivli", state: "Maharashtra", lat: 19.2403, lng: 73.1305, type: "Metro Suburb" },
  { name: "Vasai-Virar", state: "Maharashtra", lat: 19.4259, lng: 72.8225, type: "Coastal Metro" },
  { name: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567, type: "IT & Cultural Hub" },
  { name: "Pimpri-Chinchwad", state: "Maharashtra", lat: 18.6298, lng: 73.7997, type: "Auto Industrial Hub" },
  { name: "Nashik", state: "Maharashtra", lat: 19.9975, lng: 73.7898, type: "Wine Capital / Kumbh" },
  { name: "Chhatrapati Sambhajinagar (Aurangabad)", state: "Maharashtra", lat: 19.8762, lng: 75.3433, type: "Ajanta-Ellora Gateway" },
  { name: "Nagpur", state: "Maharashtra", lat: 21.1458, lng: 79.0882, type: "Orange City / Central Hub" },
  { name: "Solapur", state: "Maharashtra", lat: 17.6599, lng: 75.9064, type: "Textile Hub" },
  { name: "Kolhapur", state: "Maharashtra", lat: 16.7050, lng: 74.2433, type: "Mahalakshmi / Sugar Capital" },
  { name: "Amravati", state: "Maharashtra", lat: 20.9374, lng: 77.7796, type: "Vidarbha City" },
  { name: "Nanded", state: "Maharashtra", lat: 19.1383, lng: 77.3210, type: "Hazur Sahib Sikh Shrine" },
  { name: "Sangli", state: "Maharashtra", lat: 16.8524, lng: 74.5815, type: "Turmeric City" },
  { name: "Jalgaon", state: "Maharashtra", lat: 21.0077, lng: 75.5626, type: "Gold City / Banana Hub" },
  { name: "Akola", state: "Maharashtra", lat: 20.7002, lng: 77.0082, type: "Cotton City" },
  { name: "Latur", state: "Maharashtra", lat: 18.4088, lng: 76.5604, type: "Marathwada Hub" },
  { name: "Dhule", state: "Maharashtra", lat: 20.9042, lng: 74.7749, type: "Khandesh Gateway" },
  { name: "Ahmednagar", state: "Maharashtra", lat: 19.0948, lng: 74.7480, type: "Sugar / Military Hub" },
  { name: "Chandrapur", state: "Maharashtra", lat: 19.9615, lng: 79.2961, type: "Tadoba Tiger Gateway" },
  { name: "Parbhani", state: "Maharashtra", lat: 19.2644, lng: 76.7767, type: "Marathwada City" },
  { name: "Jalna", state: "Maharashtra", lat: 19.8347, lng: 75.8816, type: "Steel City" },
  { name: "Satara", state: "Maharashtra", lat: 17.6805, lng: 73.9935, type: "Kaas Plateau Gateway" },
  { name: "Ratnagiri", state: "Maharashtra", lat: 16.9902, lng: 73.3120, type: "Alphonso Mango / Coastal" },
  { name: "Sindhudurg", state: "Maharashtra", lat: 16.1264, lng: 73.6978, type: "Konkan Fort Capital" },
  { name: "Alibaug", state: "Maharashtra", lat: 18.6414, lng: 72.8722, type: "Coastal Beach Getaway" },
  { name: "Lonavala", state: "Maharashtra", lat: 18.7557, lng: 73.4091, type: "Sahyadri Hill Station" },
  { name: "Khandala", state: "Maharashtra", lat: 18.7618, lng: 73.3769, type: "Ghat Hill Station" },
  { name: "Mahabaleshwar", state: "Maharashtra", lat: 17.9237, lng: 73.6586, type: "Queen of Sahyadris" },
  { name: "Panchgani", state: "Maharashtra", lat: 17.9237, lng: 73.8016, type: "Table Land Hill Resort" },
  { name: "Matheran", state: "Maharashtra", lat: 18.9865, lng: 73.2679, type: "Eco Hill Station" },
  { name: "Shirdi", state: "Maharashtra", lat: 19.7667, lng: 74.4764, type: "Sai Baba Temple Pilgrimage" },
  { name: "Trimbakeshwar", state: "Maharashtra", lat: 19.9328, lng: 73.5307, type: "Jyotirlinga Shrine" },
  { name: "Lavasa", state: "Maharashtra", lat: 18.4095, lng: 73.5074, type: "Planned Lake City" },
  { name: "Karjat", state: "Maharashtra", lat: 18.9102, lng: 73.3283, type: "Trekking / Farmstay Hub" },
  { name: "Igatpuri", state: "Maharashtra", lat: 19.6974, lng: 73.5627, type: "Vipassana / Sahyadri Mist" },
  { name: "Ganpatipule", state: "Maharashtra", lat: 17.1466, lng: 73.2687, type: "Swayambhu Beach" },
  { name: "Tarkarli", state: "Maharashtra", lat: 16.0378, lng: 73.4734, type: "Scuba Diving Beach" },
  { name: "Malvan", state: "Maharashtra", lat: 16.0618, lng: 73.4682, type: "Sindhudurg Fort & Cuisine" },
  { name: "Bhandardara", state: "Maharashtra", lat: 19.5398, lng: 73.7602, type: "Arthur Lake / Waterfall Hill" },
  { name: "Ajanta & Ellora", state: "Maharashtra", lat: 20.5519, lng: 75.7033, type: "UNESCO World Heritage" },
  { name: "Wardha", state: "Maharashtra", lat: 20.7453, lng: 78.6022, type: "Sevagram Ashram" },
  { name: "Gondia", state: "Maharashtra", lat: 21.4598, lng: 80.1961, type: "Navegaon Park Hub" },
  { name: "Yavatmal", state: "Maharashtra", lat: 20.3888, lng: 78.1204, type: "Vidarbha City" },
  { name: "Dharashiv", state: "Maharashtra", lat: 18.1861, lng: 76.0419, type: "Tuljabhavani Gateway" },

  // ── GOA (12 cities & destinations) ──
  { name: "Panaji", state: "Goa", lat: 15.4909, lng: 73.8278, type: "State Capital" },
  { name: "Margao", state: "Goa", lat: 15.2832, lng: 73.9862, type: "Commercial South Hub" },
  { name: "Vasco da Gama", state: "Goa", lat: 15.3982, lng: 73.8113, type: "Port City" },
  { name: "Mapusa", state: "Goa", lat: 15.5937, lng: 73.8142, type: "North Market Hub" },
  { name: "Ponda", state: "Goa", lat: 15.4026, lng: 74.0086, type: "Spice Plantations" },
  { name: "Calangute", state: "Goa", lat: 15.5439, lng: 73.7553, type: "North Beach Hub" },
  { name: "Candolim", state: "Goa", lat: 15.5174, lng: 73.7663, type: "Aguada Fort Beach" },
  { name: "Anjuna", state: "Goa", lat: 15.5733, lng: 73.7407, type: "Sunset Cliffs" },
  { name: "Morjim", state: "Goa", lat: 15.6329, lng: 73.7337, type: "Turtle Beach" },
  { name: "Colva", state: "Goa", lat: 15.2787, lng: 73.9217, type: "South Beach" },
  { name: "Palolem", state: "Goa", lat: 15.0100, lng: 74.0232, type: "Crescent Beach" },
  { name: "Dudhsagar", state: "Goa", lat: 15.3144, lng: 74.3143, type: "Majestic Waterfall" },

  // ── RAJASTHAN (24 cities & destinations) ──
  { name: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873, type: "Pink City / Capital" },
  { name: "Udaipur", state: "Rajasthan", lat: 24.5854, lng: 73.7125, type: "City of Lakes" },
  { name: "Jodhpur", state: "Rajasthan", lat: 26.2389, lng: 73.0243, type: "Blue City" },
  { name: "Jaisalmer", state: "Rajasthan", lat: 26.9157, lng: 70.9083, type: "Golden City" },
  { name: "Bikaner", state: "Rajasthan", lat: 28.0229, lng: 73.3119, type: "Junagarh Fort City" },
  { name: "Ajmer", state: "Rajasthan", lat: 26.4499, lng: 74.6399, type: "Dargah Sharif" },
  { name: "Pushkar", state: "Rajasthan", lat: 26.4897, lng: 74.5511, type: "Brahma Temple" },
  { name: "Mount Abu", state: "Rajasthan", lat: 24.5925, lng: 72.7156, type: "Hill Station" },
  { name: "Kota", state: "Rajasthan", lat: 25.2138, lng: 75.8648, type: "Chambal River Hub" },
  { name: "Alwar", state: "Rajasthan", lat: 27.5530, lng: 76.6346, type: "Sariska Gateway" },
  { name: "Bhilwara", state: "Rajasthan", lat: 25.3407, lng: 74.6313, type: "Textile City" },
  { name: "Chittorgarh", state: "Rajasthan", lat: 24.8887, lng: 74.6269, type: "Mewar Fort City" },
  { name: "Pali", state: "Rajasthan", lat: 25.7711, lng: 73.3234, type: "Marwar Gateway" },
  { name: "Sikar", state: "Rajasthan", lat: 27.6094, lng: 75.1398, type: "Shekhawati Hub" },
  { name: "Bharatpur", state: "Rajasthan", lat: 27.2152, lng: 77.5030, type: "Keoladeo Bird Park" },
  { name: "Nathdwara", state: "Rajasthan", lat: 24.9304, lng: 73.8197, type: "Shrinathji Temple" },
  { name: "Kumbhalgarh", state: "Rajasthan", lat: 25.1528, lng: 73.5870, type: "Great Wall Fort" },
  { name: "Ranthambore", state: "Rajasthan", lat: 25.9928, lng: 76.3533, type: "Tiger Reserve" },
  { name: "Barmer", state: "Rajasthan", lat: 25.7532, lng: 71.3967, type: "Thar Desert Hub" },
  { name: "Jalore", state: "Rajasthan", lat: 25.3456, lng: 72.6152, type: "Granite City" },
  { name: "Nagaur", state: "Rajasthan", lat: 27.2070, lng: 73.7423, type: "Heritage Fort" },
  { name: "Bundi", state: "Rajasthan", lat: 25.4415, lng: 75.6441, type: "Stepwells City" },
  { name: "Mandawa", state: "Rajasthan", lat: 28.0551, lng: 75.1485, type: "Fresco Haveli" },
  { name: "Ranakpur", state: "Rajasthan", lat: 25.1189, lng: 73.4735, type: "Jain Marble Temple" }
];

const HIGHWAYS = [
  { code: "NE1", name: "Ahmedabad-Vadodara Expressway", length_km: 93, connects: "Ahmedabad <-> Vadodara" },
  { code: "NE4", name: "Delhi-Mumbai Expressway", length_km: 1386, connects: "Jaipur <-> Vadodara <-> Surat <-> Mumbai" },
  { code: "YCE", name: "Mumbai-Pune Expressway (Yashwantrao Chavan)", length_km: 94, connects: "Navi Mumbai <-> Pune" },
  { code: "HME", name: "Samruddhi Mahamarg (Mumbai-Nagpur Expressway)", length_km: 701, connects: "Mumbai <-> Nashik <-> Aurangabad <-> Nagpur" },
  { code: "NH48", name: "Golden Quadrilateral West Corridor", length_km: 2807, connects: "Delhi <-> Jaipur <-> Udaipur <-> Ahmedabad <-> Vadodara <-> Surat <-> Mumbai <-> Pune <-> Kolhapur" },
  { code: "NH66", name: "Konkan Coastal Highway", length_km: 1640, connects: "Mumbai <-> Alibaug <-> Ratnagiri <-> Sindhudurg <-> Goa <-> Karwar" },
  { code: "NH27", name: "East-West Highway Corridor", length_km: 3507, connects: "Porbandar <-> Rajkot <-> Samakhiali <-> Radhanpur <-> Palanpur <-> Abu Road <-> Udaipur <-> Kota" },
  { code: "NH47", name: "Gujarat-MP-Maharashtra Corridor", length_km: 1006, connects: "Ahmedabad <-> Godhra <-> Dahod <-> Indore <-> Nagpur" },
  { code: "NH51", name: "Saurashtra Coastal Highway", length_km: 551, connects: "Dwarka <-> Porbandar <-> Somnath <-> Bhavnagar" },
  { code: "NH53", name: "Surat-Nagpur Highway", length_km: 1781, connects: "Surat <-> Navsari <-> Vyara <-> Dhule <-> Jalgaon <-> Akola <-> Amravati <-> Nagpur" },
  { code: "NH60", name: "Pune-Nashik Highway", length_km: 360, connects: "Pune <-> Narayangaon <-> Sangamner <-> Nashik <-> Dhule" },
  { code: "NH52", name: "Solapur-Aurangabad-Dhule Corridor", length_km: 2317, connects: "Jaipur <-> Kota <-> Indore <-> Dhule <-> Aurangabad <-> Solapur" },
  { code: "NH68", name: "Thar Desert Border Highway", length_km: 428, connects: "Jaisalmer <-> Barmer <-> Sanchore <-> Radhanpur" },
  { code: "NH62", name: "Marwar-Bikaner Highway", length_km: 748, connects: "Bikaner <-> Nagaur <-> Jodhpur <-> Pali <-> Pindwara" },
  { code: "NH58", name: "Mewar-Ajmer Corridor", length_km: 620, connects: "Udaipur <-> Nathdwara <-> Bhilwara <-> Ajmer <-> Jaipur" }
];

function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dlat = ((lat2 - lat1) * Math.PI) / 180;
  const dlon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dlon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const EXACT_OVERRIDE = {
  "Surat_Ahmedabad": [265, 4.5, "NE1 / NH48 Expressway", "Road / Vande Bharat"],
  "Surat_Mumbai": [280, 5.0, "NH48 Coastal Corridor", "Road / Vande Bharat"],
  "Surat_Vadodara": [150, 2.5, "NH48 Express Route", "Road / Train"],
  "Surat_Navsari": [35, 0.8, "NH48 Twin Corridor", "Road / Cab"],
  "Surat_Vapi": [115, 2.0, "NH48 Industrial Corridor", "Road / Train"],
  "Surat_Valsad": [90, 1.6, "NH48 Coastal Road", "Road / Train"],
  "Surat_Bharuch": [75, 1.3, "NH48 Golden Bridge Corridor", "Road / Train"],
  "Surat_Ankleshwar": [65, 1.2, "NH48 Industrial Corridor", "Road / Train"],
  "Surat_Rajkot": [440, 7.5, "NH48 -> Tarapur -> NH47", "Road / Bus"],
  "Surat_Bhavnagar": [360, 6.5, "NH48 -> Dholera Express Route", "Road / Ferry / Cab"],
  "Surat_Udaipur": [500, 8.5, "NH48 -> NH58 Highway", "Road / Train"],
  "Surat_Pune": [420, 7.5, "NH48 -> Mumbai-Pune Expressway", "Road / Cab"],
  "Surat_Nashik": [235, 4.8, "NH848 via Dharampur Ghat", "Road / Cab"],
  "Surat_Goa": [870, 15.5, "NH48 -> NH66 Coastal Highway", "Train / Flight / Drive"],
  "Surat_Saputara": [160, 3.5, "SH170 via Waghai-Dang Forest", "Road / Scenic Drive"],
  "Surat_Kevadia (Statue of Unity)": [155, 3.0, "SH160 -> Garudeshwar Highway", "Road / Cab"],
  "Ahmedabad_Vadodara": [110, 1.8, "NE1 National Expressway 1", "Expressway Drive / Train"],
  "Ahmedabad_Gandhinagar": [28, 0.6, "SG Highway Corridor", "Metro / Cab"],
  "Ahmedabad_Rajkot": [215, 3.8, "NH47 Six-Lane Expressway", "Road / Vande Bharat"],
  "Ahmedabad_Udaipur": [260, 4.5, "NH48 Express Corridor", "Road / Cab"],
  "Ahmedabad_Mount Abu": [225, 4.0, "NH27 Highway via Palanpur", "Road / Cab"],
  "Ahmedabad_Somnath": [410, 7.5, "NH47 -> NH151 via Junagadh", "Road / Train"],
  "Ahmedabad_Dwarka": [440, 8.0, "NH47 -> NH947 via Jamnagar", "Road / Train"],
  "Ahmedabad_Sasan Gir": [350, 6.5, "NH47 -> Junagadh -> Mendarda", "Road / Safari Drive"],
  "Ahmedabad_Bhuj": [330, 6.0, "NH947 -> Samakhiali Highway", "Road / Vande Bharat"],
  "Ahmedabad_Kevadia (Statue of Unity)": [195, 3.5, "NE1 -> SH160 via Vadodara", "Road / Tourist Bus"],
  "Mumbai_Pune": [150, 3.0, "Mumbai-Pune Expressway (YCE)", "Road / Cab / Vande Bharat"],
  "Mumbai_Nashik": [165, 3.5, "Samruddhi Mahamarg / NH160 (Kasara Ghat)", "Road / Vande Bharat"],
  "Mumbai_Goa": [585, 10.5, "NH66 Coastal Highway", "Vande Bharat / Road Drive"],
  "Mumbai_Lonavala": [85, 1.8, "Mumbai-Pune Expressway", "Road / Train"],
  "Mumbai_Mahabaleshwar": [260, 5.5, "Mumbai-Pune Expressway -> Wai Ghat", "Road / Cab"],
  "Mumbai_Alibaug": [95, 2.5, "MTHL / Ro-Ro Ferry + Road", "Speedboat / Road"],
  "Mumbai_Shirdi": [240, 4.5, "Samruddhi Mahamarg (Expressway)", "Road / Vande Bharat"],
  "Mumbai_Kolhapur": [380, 7.0, "NH48 Six-Lane Highway", "Road / Vande Bharat"],
  "Mumbai_Nagpur": [700, 8.5, "Samruddhi Mahamarg Expressway", "Expressway / Vande Bharat / Flight"],
  "Pune_Mahabaleshwar": [120, 2.8, "NH48 -> Shirwal -> Wai Ghat", "Road / Cab"],
  "Pune_Goa": [440, 8.5, "NH48 -> Belagavi / Amboli Ghat", "Road / Sleeper Bus"],
  "Pune_Lonavala": [65, 1.2, "Mumbai-Pune Expressway", "Road / Local Train"],
  "Pune_Shirdi": [185, 4.0, "Pune-Nashik Highway via Sangamner", "Road / Cab"],
  "Pune_Kolhapur": [235, 4.5, "NH48 Southern Maharashtra Corridor", "Road / Train"],
  "Udaipur_Jaipur": [395, 6.5, "NH58 -> Ajmer Highway", "Vande Bharat / Road"],
  "Udaipur_Jodhpur": [250, 4.8, "NH62 Highway via Ranakpur Ghat", "Road / Cab"],
  "Udaipur_Jaisalmer": [490, 8.5, "NH68 Desert Route", "Road / Sleeper Bus"],
  "Udaipur_Mount Abu": [165, 3.0, "NH27 Highway via Pindwara", "Road / Cab"],
  "Udaipur_Kumbhalgarh": [85, 2.0, "SH32 Scenic Mewar Route", "Road / Cab"],
  "Jaipur_Jodhpur": [330, 5.5, "NH25 / Ajmer Expressway", "Vande Bharat / Road"],
  "Jaipur_Jaisalmer": [560, 9.5, "NH11 Desert Highway", "Road / Sleeper Train"],
  "Jaipur_Mount Abu": [490, 8.0, "NH48 -> NH27 via Ajmer-Pali", "Road / Train"],
  "Jaipur_Ranthambore": [155, 3.0, "NE4 Delhi-Mumbai Expressway", "Road / Train"]
};

const matrix = {};

for (let i = 0; i < CITIES.length; i++) {
  const orig = CITIES[i];
  matrix[orig.name] = {};
  for (let j = 0; j < CITIES.length; j++) {
    if (i === j) continue;
    const dest = CITIES[j];
    const key1 = `${orig.name}_${dest.name}`;
    const key2 = `${dest.name}_${orig.name}`;

    let dist, hrs, route, mode;

    if (EXACT_OVERRIDE[key1]) {
      [dist, hrs, route, mode] = EXACT_OVERRIDE[key1];
    } else if (EXACT_OVERRIDE[key2]) {
      [dist, hrs, route, mode] = EXACT_OVERRIDE[key2];
    } else {
      const crow = haversineDist(orig.lat, orig.lng, dest.lat, dest.lng);
      const factor = crow > 250 ? 1.25 : 1.32;
      dist = Math.round(crow * factor);
      const speed = dist > 150 ? 65.0 : 45.0;
      hrs = Math.round((dist / speed) * 10) / 10;

      if (orig.state.includes('Gujarat') && dest.state.includes('Gujarat')) {
        route = 'NH48 / NE1 / NH47 Gujarat Corridor';
      } else if (orig.state.includes('Maharashtra') && dest.state.includes('Maharashtra')) {
        route = 'Samruddhi Mahamarg / NH48 / NH66 Maharashtra Corridor';
      } else if (orig.state.includes('Rajasthan') && dest.state.includes('Rajasthan')) {
        route = 'NH48 / NH27 / NH11 Rajasthan Highway';
      } else if (orig.state.includes('Goa') || dest.state.includes('Goa')) {
        route = 'NH66 Konkan / NH48 Western Ghats Highway';
      } else {
        route = 'NH48 / NE4 Interstate Express Corridor';
      }

      mode = dist < 500 ? 'Road Drive / Cab' : dist < 900 ? 'Express Train / Sleeper Bus' : 'Flight / Express Train';
    }

    matrix[orig.name][dest.name] = {
      distance_km: dist,
      duration_hours: hrs,
      route,
      mode
    };
  }
}

const payload = {
  zone: "west",
  zone_name: "Western Zone (Gujarat, Maharashtra, Goa, Rajasthan - 121 Complete Cities & Corridors)",
  total_cities: CITIES.length,
  total_corridors: CITIES.length * (CITIES.length - 1),
  highways: HIGHWAYS,
  cities: CITIES,
  matrix
};

const targetPath = path.join(__dirname, '../abcd/knowledge/zone_west.json');
fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf-8');
console.log(`Successfully written ${CITIES.length} cities and ${HIGHWAYS.length} highways into: ${targetPath}`);
