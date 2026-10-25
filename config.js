// ===== GFA Results Portal – configuration =====
window.GFA = {
  // Firebase Realtime Database (accessed through its REST API – no SDK needed)
  DB_URL: "https://general-b9b11-default-rtdb.firebaseio.com",

  // Paystack PUBLIC key only. NEVER put the secret key (sk_...) in browser code.
  PAYSTACK_PUBLIC_KEY: "pk_live_b6f97586122addad3266156fe124d7da8113f810",
  CURRENCY: "GHS",

  // Admin login (password is stored as a SHA-256 hash, not plain text)
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: "57064e433844146dbe13e34c65cab0a449ebae190c964af546fcdd58525296a5",

  // Max PDF size (PDFs are stored inside the Realtime Database as base64)
  MAX_PDF_MB: 2
};
