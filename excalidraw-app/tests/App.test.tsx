import React from "react";
import { vi } from "vitest";

import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import {
  act,
  render,
  screen,
  unmountComponent,
  waitFor,
} from "@excalidraw/excalidraw/tests/test-utils";

import ExcalidrawApp from "../App";

const activeFileMocks = vi.hoisted(() => {
  return {
    autosaveToActiveFile: vi.fn(),
    ensureActiveFileWritable: vi.fn(),
    loadFromActiveFile: vi.fn(),
    persistActiveFileHandle: vi.fn(),
  };
});

const overwriteConfirmMocks = vi.hoisted(() => {
  return {
    openConfirmModal: vi.fn(),
  };
});

vi.mock("../../excalidraw-app/data/ActiveFile", async () => {
  const actual = await vi.importActual<
    typeof import("../../excalidraw-app/data/ActiveFile")
  >("../../excalidraw-app/data/ActiveFile");

  return {
    ...actual,
    autosaveToActiveFile: activeFileMocks.autosaveToActiveFile,
    ensureActiveFileWritable: activeFileMocks.ensureActiveFileWritable,
    loadFromActiveFile: activeFileMocks.loadFromActiveFile,
    persistActiveFileHandle: activeFileMocks.persistActiveFileHandle,
  };
});

vi.mock(
  "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState",
  async () => {
    const actual = await vi.importActual<
      typeof import("@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState")
    >(
      "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState",
    );

    return {
      ...actual,
      openConfirmModal: overwriteConfirmMocks.openConfirmModal,
    };
  },
);

describe("ExcalidrawApp autosave recovery", () => {
  beforeEach(() => {
    unmountComponent();
    localStorage.clear();
    activeFileMocks.autosaveToActiveFile.mockReset();
    activeFileMocks.ensureActiveFileWritable.mockReset();
    activeFileMocks.loadFromActiveFile.mockReset();
    activeFileMocks.persistActiveFileHandle.mockReset();
    overwriteConfirmMocks.openConfirmModal.mockReset();

    activeFileMocks.autosaveToActiveFile.mockRejectedValue(
      new Error("Disk autosave failed"),
    );
    activeFileMocks.ensureActiveFileWritable.mockResolvedValue(true);
    activeFileMocks.loadFromActiveFile.mockResolvedValue(null);
    activeFileMocks.persistActiveFileHandle.mockResolvedValue(undefined);
    overwriteConfirmMocks.openConfirmModal.mockResolvedValue(false);
  });

  it("disables the active file after autosave failures so stale files are not restored later", async () => {
    await render(<ExcalidrawApp />);

    const fileHandle = {
      name: "diagram.excalidraw",
    } as FileSystemFileHandle;

    const rectangle = API.createElement({
      id: "rect",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    API.updateScene({
      elements: [rectangle],
      appState: {
        fileHandle,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    act(() => {
      window.dispatchEvent(new Event("beforeunload"));
    });

    await waitFor(() => {
      expect(activeFileMocks.autosaveToActiveFile).toHaveBeenCalled();
      expect(window.h.state.fileHandle).toBe(null);
    });

    expect(activeFileMocks.persistActiveFileHandle).toHaveBeenCalledWith(
      fileHandle,
    );
    expect(activeFileMocks.persistActiveFileHandle).toHaveBeenCalledWith(null);

    expect(
      await screen.findByText(
        /Autosave to the current file was disabled\. Recent changes remain in browser storage for this tab\./,
      ),
    ).toBeTruthy();
  });

  it("asks before replacing a newer browser backup with an older active file", async () => {
    localStorage.setItem(
      "version-dataState",
      JSON.stringify(Date.now() + 10_000),
    );

    const localRectangle = API.createElement({
      id: "local",
      type: "rectangle",
      x: 10,
      y: 10,
      width: 120,
      height: 80,
    });

    activeFileMocks.loadFromActiveFile.mockResolvedValue({
      data: {
        elements: [
          API.createElement({
            id: "disk",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 100,
            height: 100,
          }),
        ],
        appState: {
          fileHandle: {
            name: "diagram.excalidraw",
          } as FileSystemFileHandle,
        },
        files: {},
      },
      lastModified: Date.now(),
    });
    overwriteConfirmMocks.openConfirmModal.mockResolvedValue(true);

    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [localRectangle],
        appState: {},
      },
    });

    expect(overwriteConfirmMocks.openConfirmModal).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Restore newer browser backup?",
        actionLabel: "Restore browser version",
      }),
    );
    expect(window.h.elements.map((element) => element.id)).toContain("local");
    expect(window.h.elements.map((element) => element.id)).not.toContain(
      "disk",
    );
  });
});
