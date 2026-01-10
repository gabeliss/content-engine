import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
  Home as HomeIcon,
  Library as LibraryIcon,
  BarChart3,
  Zap,
  Settings as SettingsIcon,
  Layers,
  Video,
  Users,
  Calendar,
} from "lucide-react";

// Pages
import Home from "./pages/Home";
import Library from "./pages/Library";
import Analytics from "./pages/Analytics";
import Automations from "./pages/Automations";
import Slideshows from "./pages/Slideshows";
import HookDemo from "./pages/HookDemo";
import AIUGC from "./pages/AIUGC";
import SettingsPage from "./pages/Settings";

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const generalNavItems = [
    { path: "/", label: "Home", icon: HomeIcon },
    { path: "/library", label: "Library", icon: LibraryIcon },
    { path: "/analytics", label: "Analytics", icon: BarChart3 },
    { path: "/automations", label: "Automations", icon: Calendar },
  ];

  const playgroundNavItems = [
    { path: "/slideshows", label: "Slideshows", icon: Layers },
    { path: "/hook-demo", label: "Hook + Demo", icon: Video },
    { path: "/ai-ugc", label: "AI UGC", icon: Users },
  ];

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Zap size={20} style={{ display: "inline", marginRight: "0.5rem" }} />
          Content Engine
        </div>

        <nav className="sidebar-nav">
          {generalNavItems.map((item) => (
            <div
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon size={18} />
              {item.label}
            </div>
          ))}

          {/* Playground Section */}
          <div style={{ marginTop: "1.5rem", marginBottom: "0.5rem", padding: "0 1rem" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Playground
            </div>
          </div>

          {playgroundNavItems.map((item) => (
            <div
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <item.icon size={18} />
              {item.label}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
          <div
            className={`nav-item ${location.pathname === "/settings" ? "active" : ""}`}
            onClick={() => navigate("/settings")}
          >
            <SettingsIcon size={18} />
            Settings
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home onNavigate={(path) => navigate(path)} />} />
          <Route path="/library" element={<Library onNavigate={(path) => navigate(path)} />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/automations" element={<Automations />} />
          <Route path="/slideshows" element={<Slideshows />} />
          <Route path="/hook-demo" element={<HookDemo />} />
          <Route path="/ai-ugc" element={<AIUGC />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
