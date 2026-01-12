import { Id } from "../../../../convex/_generated/dataModel";
import { AccountStats } from "../types";

interface AccountTabsProps {
  accounts: AccountStats[];
  selectedAccountId: Id<"accounts"> | null;
  onSelectAccount: (accountId: Id<"accounts"> | null) => void;
}

export function AccountTabs({
  accounts,
  selectedAccountId,
  onSelectAccount,
}: AccountTabsProps) {
  if (accounts.length <= 1) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "0.5rem",
        flexWrap: "wrap",
        marginBottom: "1.5rem",
      }}
    >
      <button
        onClick={() => onSelectAccount(null)}
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "8px",
          border: "1px solid",
          borderColor: selectedAccountId === null ? "#3b82f6" : "#e5e7eb",
          background: selectedAccountId === null ? "#eff6ff" : "white",
          color: selectedAccountId === null ? "#3b82f6" : "#374151",
          fontSize: "0.875rem",
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        All Accounts
      </button>
      {accounts.map((accountStat) => {
        if (!accountStat.account) return null;
        const isSelected = selectedAccountId === accountStat.account._id;
        return (
          <button
            key={accountStat.account._id}
            onClick={() => onSelectAccount(accountStat.account!._id)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid",
              borderColor: isSelected ? "#3b82f6" : "#e5e7eb",
              background: isSelected ? "#eff6ff" : "white",
              color: isSelected ? "#3b82f6" : "#374151",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {accountStat.account.avatarUrl && (
              <img
                src={accountStat.account.avatarUrl}
                alt=""
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                }}
              />
            )}
            @{accountStat.account.username}
          </button>
        );
      })}
    </div>
  );
}
