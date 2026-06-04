"use client";

export type ActiveTab = "text" | "reference" | "video";

interface TabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: "text", label: "Text" },
    { id: "reference", label: "Text and Reference" },
    { id: "video", label: "Video" },
  ];

  return (
    <div className="border-b border-neutral-800 bg-neutral-950">
      <div className="max-w-screen-xl mx-auto px-6">
        <nav className="flex gap-0" role="tablist">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => onTabChange(tab.id)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? "border-violet-500 text-violet-300"
                    : "border-transparent text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
