import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";

export const AppFooter = React.memo(
  ({
    onChange,
    lastSavedLabel,
  }: {
    onChange: () => void;
    lastSavedLabel: string | null;
  }) => {
    return (
      <Footer>
        <div
          style={{
            display: "flex",
            width: "100%",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          {!isExcalidrawPlusSignedUser && <EncryptedIcon />}
          {lastSavedLabel && (
            <div
              data-testid="last-saved-badge"
              style={{
                marginLeft: "auto",
                fontSize: 12,
                lineHeight: 1.2,
                color: "var(--color-gray-100)",
                whiteSpace: "nowrap",
              }}
            >
              {lastSavedLabel}
            </div>
          )}
        </div>
      </Footer>
    );
  },
);
