"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppSettings, getAppSettings, updateAppSettings } from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { useToast } from "@/lib/toast";

const defaultSettings: AppSettings = {
  leave: {
    annualLeaveDays: 21,
    sickLeaveDays: 12,
    resetMonth: 1,
    carryForwardAllowed: false,
  },
  attendance: {
    requiredMinutes: 420,
    graceMinutes: 360,
    breakReminderMinutes: 30,
    missingCheckoutMinutes: 600,
    heartbeatStaleMinutes: 10,
    adminOverrideEnabled: true,
  },
  session: {
    idleTimeoutMinutes: 60,
    warningSeconds: 60,
    browserSessionOnly: true,
  },
};

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function SettingsPage() {
  const { loading: authLoading } = useAuth(["ADMIN"]);
  const toast = useToast();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    async function loadSettings() {
      setLoading(true);
      try {
        const data = await getAppSettings();
        if (!cancelled) setSettings(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [authLoading, toast]);

  function updateNumber(section: "leave" | "attendance" | "session", key: string, value: string) {
    const parsed = Number(value);
    setSettings(current => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: Number.isFinite(parsed) ? parsed : 0,
      },
    }));
  }

  function updateBoolean(section: "attendance", key: string, value: boolean) {
    setSettings(current => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value,
      },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (settings.attendance.graceMinutes > settings.attendance.requiredMinutes) {
      toast.error("Grace minutes should not be higher than required minutes.");
      return;
    }
    setSaving(true);
    try {
      const saved = await updateAppSettings({
        ...settings,
        leave: {
          ...settings.leave,
          carryForwardAllowed: false,
        },
        session: {
          ...settings.session,
          browserSessionOnly: true,
        },
      });
      setSettings(saved);
      toast.success("Settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return <div className="p-8">Loading settings...</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="settings-header">
        <div>
          <h1>Settings</h1>
          <p>Company defaults for leave, attendance, and browser sessions.</p>
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="settings-grid">
        <section className="glass-card settings-section">
          <div className="settings-section-head">
            <h2>Leave</h2>
            <p>Annual and sick leave allowances reset every year. Carry-forward is disabled.</p>
          </div>
          <div className="settings-field-grid">
            <NumberField label="Annual leave days" value={settings.leave.annualLeaveDays} min={0} max={365} onChange={value => updateNumber("leave", "annualLeaveDays", value)} />
            <NumberField label="Sick leave days" value={settings.leave.sickLeaveDays} min={0} max={365} onChange={value => updateNumber("leave", "sickLeaveDays", value)} />
            <label className="settings-field">
              <span>Reset month</span>
              <select value={settings.leave.resetMonth} onChange={event => updateNumber("leave", "resetMonth", event.target.value)}>
                {months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
              </select>
            </label>
            <div className="settings-readonly">
              <span>Carry forward</span>
              <strong>Disabled</strong>
            </div>
          </div>
        </section>

        <section className="glass-card settings-section">
          <div className="settings-section-head">
            <h2>Attendance</h2>
            <p>Control daily target time, grace threshold, break reminders, and admin overrides.</p>
          </div>
          <div className="settings-field-grid">
            <NumberField label="Required minutes" value={settings.attendance.requiredMinutes} min={1} max={1440} onChange={value => updateNumber("attendance", "requiredMinutes", value)} />
            <NumberField label="Grace minutes" value={settings.attendance.graceMinutes} min={0} max={1440} onChange={value => updateNumber("attendance", "graceMinutes", value)} />
            <NumberField label="Break reminder minutes" value={settings.attendance.breakReminderMinutes} min={1} max={240} onChange={value => updateNumber("attendance", "breakReminderMinutes", value)} />
            <NumberField label="Missing checkout minutes" value={settings.attendance.missingCheckoutMinutes} min={1} max={1440} onChange={value => updateNumber("attendance", "missingCheckoutMinutes", value)} />
            <NumberField label="Heartbeat stale minutes" value={settings.attendance.heartbeatStaleMinutes} min={1} max={120} onChange={value => updateNumber("attendance", "heartbeatStaleMinutes", value)} />
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.attendance.adminOverrideEnabled}
                onChange={event => updateBoolean("attendance", "adminOverrideEnabled", event.target.checked)}
              />
              <span>Allow admins to start or close employee sessions</span>
            </label>
          </div>
        </section>

        <section className="glass-card settings-section">
          <div className="settings-section-head">
            <h2>Session</h2>
            <p>Browser-login behavior for idle users without an active work session.</p>
          </div>
          <div className="settings-field-grid">
            <NumberField label="Idle timeout minutes" value={settings.session.idleTimeoutMinutes} min={5} max={1440} onChange={value => updateNumber("session", "idleTimeoutMinutes", value)} />
            <NumberField label="Warning seconds" value={settings.session.warningSeconds} min={10} max={600} onChange={value => updateNumber("session", "warningSeconds", value)} />
            <div className="settings-readonly">
              <span>Browser session only</span>
              <strong>Enabled</strong>
            </div>
          </div>
        </section>
      </div>
    </form>
  );
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: string) => void }) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input type="number" value={value} min={min} max={max} onChange={event => onChange(event.target.value)} />
    </label>
  );
}
