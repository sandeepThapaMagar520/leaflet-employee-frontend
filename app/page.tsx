import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "32px" }}>
      <div className="glass-panel" style={{ width: "min(560px, 100%)", padding: "38px", textAlign: "center" }}>
        <div style={{
          width: "54px",
          height: "54px",
          borderRadius: "8px",
          margin: "0 auto 18px",
          background: "linear-gradient(135deg, #0f766e, #2563eb)",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: "1rem",
          letterSpacing: "0.04em",
        }}>
          LF
        </div>
        <h1 className="text-gradient" style={{ fontSize: "2.3rem", marginBottom: "12px" }}>Leaflet Employee</h1>
        <p className="text-muted" style={{ lineHeight: 1.6, marginBottom: "26px" }}>
          A professional workspace for attendance, projects, tasks, leave, and team operations.
        </p>
        <Link href="/login" className="btn-primary" style={{ display: "inline-flex" }}>
          Go to Login
        </Link>
      </div>
    </main>
  );
}
