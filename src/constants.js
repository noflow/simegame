-export const TIME_SLOTS = ["early_morning","morning","lunch","afternoon","evening","night"];
-export const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
-export const API_URL = "https://api.pawan.krd/cosmosrp-3.5-msr/v1/chat/completions";
+export const TIME_SLOTS = ["early_morning","morning","lunch","afternoon","evening","night"];
+export const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
+// CosmosRP defaults
+export const COSMOS_BASE_URL = "https://api.pawan.krd/cosmosrp/v1";
+export const API_URL = `${COSMOS_BASE_URL}/chat/completions`;
+export const COSMOS_MODEL = "cosmosrp-v3.5"; // adjust if you need another version
