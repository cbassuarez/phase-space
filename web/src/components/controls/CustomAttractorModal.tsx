import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Pencil, Plus, Trash2, X, type LucideIcon } from "lucide-react";
import { useViewerState } from "../../state/viewerState";
import {
  ATTRACTOR_TEMPLATES,
  encodeToHash,
  exportJSON,
  parseManifest,
  slugify,
  type AttractorDef,
} from "../../data/customAttractors";
import type { AttractorValidation } from "../../hooks/usePhaseWasmEngine";
import {
  commandButtonClass,
  controlFocusRing,
  controlTransition,
  sectionHeadingClass,
} from "./controlStyles";
import clsx from "clsx";

const COMMUNITY_REPO = "cbassuarez/phase-space-attractors";
type ModalPane = "editor" | "community";
const MODAL_TABS: { id: ModalPane; label: string; Icon: LucideIcon }[] = [
  { id: "editor", label: "Define", Icon: Plus },
  { id: "community", label: "Community", Icon: Download },
];

const fieldClass =
  "w-full rounded-[8px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-control-bg)] px-2 py-1.5 text-[12px] text-[color:var(--ps-text)] outline-none focus-visible:border-[color:var(--ps-control-selected-marker)]";
const monoClass = clsx(fieldClass, "font-mono");
const labelClass = "text-[10px] font-semibold lowercase tracking-tight text-[color:var(--ps-text-muted)]";

function EquationRow({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="w-12 shrink-0 font-mono text-[11px] text-[color:var(--ps-text-soft)]">{label} =</span>
        <input
          className={clsx(monoClass, error && "border-red-500")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
      {error && <span className="pl-14 text-[10px] text-red-500">{error}</span>}
    </div>
  );
}

export default function CustomAttractorModal({ initial }: { initial: AttractorDef }) {
  const {
    closeAttractorEditor,
    setCustomAttractor,
    saveCustomAttractor,
    deleteCustomAttractor,
    installCommunityAttractor,
    validateAttractor,
    customAttractors,
    communityAttractors,
  } = useViewerState();

  const [def, setDef] = useState<AttractorDef>(initial);
  const [activePane, setActivePane] = useState<ModalPane>("editor");
  const [validation, setValidation] = useState<AttractorValidation | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState("");

  const isSaved = useMemo(() => customAttractors.some((d) => d.id === def.id), [customAttractors, def.id]);
  const installedById = useMemo(
    () => new Map(customAttractors.map((d) => [d.id, d])),
    [customAttractors]
  );

  // Debounced validate + live preview on every edit.
  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const result = validateAttractor(def);
      setValidation(result);
      if (result?.ok) setCustomAttractor(def);
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def]);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2200);
  };

  const update = (patch: Partial<AttractorDef>) => setDef((d) => ({ ...d, ...patch }));
  const updateEq = (k: "dx" | "dy" | "dz", v: string) =>
    setDef((d) => ({ ...d, equations: { ...d.equations, [k]: v } }));

  const err = (k: "dx" | "dy" | "dz") => {
    const e = validation?.errors?.[k];
    return e ? e.message : null;
  };

  const loadTemplate = (id: string) => {
    const t = ATTRACTOR_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    setDef({
      ...t,
      id: `local/${slugify(t.name)}-${Date.now().toString(36)}`,
      name: t.name,
      source: "local",
    });
  };

  const onSave = () => {
    const named = {
      ...def,
      id: def.id.startsWith("local/") || isSaved ? def.id : `local/${slugify(def.name)}-${Date.now().toString(36)}`,
    };
    saveCustomAttractor(named);
    setDef(named);
    flash("Saved to My attractors");
  };

  const onExport = async () => {
    try {
      await navigator.clipboard.writeText(exportJSON(def));
      flash("Manifest copied");
    } catch {
      flash("Copy failed");
    }
  };

  const onCopyLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}${encodeToHash(def)}`;
      await navigator.clipboard.writeText(url);
      flash("Share link copied");
    } catch {
      flash("Copy failed");
    }
  };

  const onImport = () => {
    try {
      setDef(parseManifest(importText));
      setImporting(false);
      setImportText("");
      flash("Imported");
    } catch {
      flash("Invalid manifest JSON");
    }
  };

  const onInstallCommunity = (candidate: AttractorDef) => {
    const installed = { ...candidate, source: "local" as const };
    installCommunityAttractor(installed);
    setDef(installed);
    flash("Installed to My attractors");
  };

  const openInstalledCommunity = (candidate: AttractorDef) => {
    const installed = installedById.get(candidate.id);
    if (!installed) return;
    setDef(installed);
    setActivePane("editor");
  };

  const onSubmit = () => {
    if (validation && !validation.ok) {
      flash("Fix the equation errors before submitting");
      return;
    }
    if (!def.name.trim() || def.name.trim().toLowerCase() === "untitled") {
      flash("Give your attractor a name first");
      return;
    }
    // Land the user on the prefilled GitHub Issue *Form* (friendly fields), not
    // a raw issue. Param keys match the form field ids; the manifest field
    // (render: json) gives CI a clean block to parse.
    const paramsText = def.params
      .map(
        (p) =>
          `${p.name} = ${p.default}` +
          (p.min != null ? `, ${p.min}` : "") +
          (p.max != null ? `, ${p.max}` : "")
      )
      .join("\n");
    const seedsText = def.seeds.map((s) => s.x.join(", ")).join("\n");
    const q = new URLSearchParams({
      template: "attractor.yml",
      title: `Attractor: ${def.name}`,
      name: def.name,
      author: def.author ?? "",
      description: def.description ?? "",
      dx: def.equations.dx,
      dy: def.equations.dy,
      dz: def.equations.dz,
      params: paramsText,
      seeds: seedsText,
      manifest: exportJSON(def),
      license: def.license ?? "CC0",
    });
    window.open(
      `https://github.com/${COMMUNITY_REPO}/issues/new?${q.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 0.61, 0.36, 1] }}
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label="My attractors"
        initial={{ y: 14, scale: 0.97, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 14, scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
        className="flex h-[min(760px,calc(100vh-2rem))] w-full max-w-[520px] flex-col gap-3 overflow-hidden rounded-[16px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-4 shadow-[var(--ps-shadow-soft)]"
      >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold lowercase tracking-tight text-[color:var(--ps-text)]">
          my attractors
        </div>
        <button
          type="button"
          onClick={closeAttractorEditor}
          className={clsx("inline-flex h-7 w-7 items-center justify-center rounded-full", controlFocusRing)}
          aria-label="Close editor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div role="tablist" aria-label="Attractor sections" className="relative z-10 flex items-end gap-1.5 px-1">
        {MODAL_TABS.map(({ id, label, Icon }) => {
          const isActive = activePane === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActivePane(id)}
              className={clsx(
                "relative flex flex-1 items-center justify-center gap-1.5 rounded-t-[10px] border px-3 text-xs font-medium outline-none",
                controlTransition,
                controlFocusRing,
                isActive
                  ? "z-10 -mb-px min-h-[2.3rem] border-[color:var(--ps-border-subtle)] border-b-transparent bg-[color:var(--ps-panel-bg)] text-[color:var(--ps-text)]"
                  : "min-h-9 border-transparent bg-[color:var(--ps-control-group-bg)] text-[color:var(--ps-text-soft)] hover:bg-[color:var(--ps-control-hover-bg)] hover:text-[color:var(--ps-text)]"
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-b-[12px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-panel-bg)] p-3">
      {notice && <div className="rounded-md bg-[color:var(--ps-control-bg)] px-2 py-1 text-[11px] text-[color:var(--ps-text-soft)]">{notice}</div>}

      {activePane === "editor" ? (
        <>
      {/* name + template */}
      <div className="flex flex-col gap-1">
        <span className={labelClass}>name</span>
        <input className={fieldClass} value={def.name} onChange={(e) => update({ name: e.target.value })} />
      </div>
      <div className="flex flex-col gap-1">
        <span className={labelClass}>start from a template</span>
        <select className={fieldClass} value="" onChange={(e) => e.target.value && loadTemplate(e.target.value)}>
          <option value="">— pick a template —</option>
          {ATTRACTOR_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* equations */}
      <div className="flex flex-col gap-2">
        <div className={sectionHeadingClass}>equations</div>
        <EquationRow label="dx" value={def.equations.dx} error={err("dx")} onChange={(v) => updateEq("dx", v)} />
        <EquationRow label="dy" value={def.equations.dy} error={err("dy")} onChange={(v) => updateEq("dy", v)} />
        <EquationRow label="dz" value={def.equations.dz} error={err("dz")} onChange={(v) => updateEq("dz", v)} />
        <p className="text-[10px] leading-relaxed text-[color:var(--ps-text-muted)]">
          Variables <span className="font-mono">x y z t</span>, your parameters, and{" "}
          <span className="font-mono">+ - * / ^ ( )</span>, <span className="font-mono">sin cos exp sqrt abs tanh …</span>
        </p>
      </div>

      {/* parameters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className={sectionHeadingClass}>parameters</div>
          <button
            type="button"
            onClick={() => update({ params: [...def.params, { name: `p${def.params.length + 1}`, default: 1 }] })}
            className={clsx("inline-flex h-6 w-6 items-center justify-center rounded-full", controlFocusRing)}
            aria-label="Add parameter"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {def.params.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              className={clsx(monoClass, "w-20")}
              value={p.name}
              onChange={(e) => {
                const params = [...def.params];
                params[i] = { ...p, name: e.target.value };
                update({ params });
              }}
            />
            <input
              className={clsx(fieldClass, "w-16 tabular-nums")}
              type="number"
              step="any"
              value={p.default}
              onChange={(e) => {
                const params = [...def.params];
                params[i] = { ...p, default: parseFloat(e.target.value) || 0 };
                update({ params });
              }}
            />
            <input
              className={clsx(fieldClass, "w-14 tabular-nums")}
              type="number"
              step="any"
              placeholder="min"
              value={p.min ?? ""}
              onChange={(e) => {
                const params = [...def.params];
                params[i] = { ...p, min: e.target.value === "" ? undefined : parseFloat(e.target.value) };
                update({ params });
              }}
            />
            <input
              className={clsx(fieldClass, "w-14 tabular-nums")}
              type="number"
              step="any"
              placeholder="max"
              value={p.max ?? ""}
              onChange={(e) => {
                const params = [...def.params];
                params[i] = { ...p, max: e.target.value === "" ? undefined : parseFloat(e.target.value) };
                update({ params });
              }}
            />
            <button
              type="button"
              onClick={() => update({ params: def.params.filter((_, j) => j !== i) })}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--ps-text-muted)] hover:text-red-500"
              aria-label="Remove parameter"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* integration */}
      <div className="flex flex-col gap-2">
        <div className={sectionHeadingClass}>integration</div>
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>dt</span>
            <input
              className={clsx(fieldClass, "tabular-nums")}
              type="number"
              step="any"
              value={def.integrator.dt}
              onChange={(e) => update({ integrator: { ...def.integrator, dt: parseFloat(e.target.value) || 0.01 } })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>steps</span>
            <input
              className={clsx(fieldClass, "tabular-nums")}
              type="number"
              value={def.integrator.steps}
              onChange={(e) =>
                update({ integrator: { ...def.integrator, steps: Math.min(200000, parseInt(e.target.value) || 1000) } })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>discard</span>
            <input
              className={clsx(fieldClass, "tabular-nums")}
              type="number"
              value={def.integrator.discardInitial ?? 0}
              onChange={(e) =>
                update({ integrator: { ...def.integrator, discardInitial: parseInt(e.target.value) || 0 } })
              }
            />
          </label>
        </div>
      </div>

      {/* import */}
      {importing && (
        <div className="flex flex-col gap-2">
          <textarea
            className={clsx(monoClass, "h-24 resize-none")}
            placeholder="Paste an attractor manifest JSON…"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" onClick={onImport} className={commandButtonClass(false, { size: "sm" })}>
              Load
            </button>
            <button type="button" onClick={() => setImporting(false)} className={commandButtonClass(false, { size: "sm" })}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* actions */}
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <div className="flex gap-2">
          <button type="button" onClick={onSave} className={clsx(commandButtonClass(true, { size: "sm" }), "flex-1")}>
            Save
          </button>
          {isSaved && (
            <button
              type="button"
              onClick={() => {
                deleteCustomAttractor(def.id);
                closeAttractorEditor();
              }}
              className={commandButtonClass(false, { size: "sm" })}
            >
              Delete
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onExport} className={commandButtonClass(false, { size: "sm" })}>
            Copy JSON
          </button>
          <button type="button" onClick={onCopyLink} className={commandButtonClass(false, { size: "sm" })}>
            Copy link
          </button>
          <button type="button" onClick={() => setImporting((v) => !v)} className={commandButtonClass(false, { size: "sm" })}>
            Import
          </button>
          <button type="button" onClick={onSubmit} className={commandButtonClass(false, { size: "sm" })}>
            Submit ↗
          </button>
        </div>
      </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={sectionHeadingClass}>community packs</div>
          {communityAttractors.length === 0 ? (
            <p className="text-[10px] leading-relaxed text-[color:var(--ps-text-muted)]">
              No community packs available.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {communityAttractors.map((candidate) => {
                const installed = installedById.has(candidate.id);
                return (
                  <div
                    key={candidate.id}
                    className="flex items-start gap-2 rounded-[10px] border border-[color:var(--ps-border-subtle)] bg-[color:var(--ps-control-bg)] p-2 [box-shadow:var(--ps-control-shadow)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold text-[color:var(--ps-text)]">
                        {candidate.name}
                      </div>
                      <div className="mt-0.5 text-[10px] leading-relaxed text-[color:var(--ps-text-muted)]">
                        {candidate.description || candidate.author || candidate.id}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        installed ? openInstalledCommunity(candidate) : onInstallCommunity(candidate)
                      }
                      className={commandButtonClass(installed, { size: "sm" })}
                    >
                      {installed ? <Pencil className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                      {installed ? "Open" : "Install"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </div>
      </motion.aside>
    </motion.div>
  );
}
