// SRC public browser configuration — never put credentials in this file.
// Cloudflare Pages: https://srcenterprises.in -> API: https://api.srcenterprises.in
// Local PowerShell development keeps HTTP localhost:8080.
window.SRC_API_BASE = ["localhost","127.0.0.1"].includes(location.hostname)
  ? "http://localhost:8080"
  : "https://api.srcenterprises.in";
