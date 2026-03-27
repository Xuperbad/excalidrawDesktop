import React from "react";
import { vi } from "vitest";

import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import {
  act,
  fireEvent,
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

const jsonMocks = vi.hoisted(() => {
  return {
    loadFromJSON: vi.fn(),
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

vi.mock("@excalidraw/excalidraw/data/json", async () => {
  const actual = await vi.importActual<
    typeof import("@excalidraw/excalidraw/data/json")
  >("@excalidraw/excalidraw/data/json");

  return {
    ...actual,
    loadFromJSON: jsonMocks.loadFromJSON,
  };
});

describe("ExcalidrawApp startup file gate", () => {
  beforeEach(() => {
    unmountComponent();
    localStorage.clear();
    activeFileMocks.autosaveToActiveFile.mockReset();
    activeFileMocks.ensureActiveFileWritable.mockReset();
    activeFileMocks.loadFromActiveFile.mockReset();
    activeFileMocks.persistActiveFileHandle.mockReset();
    jsonMocks.loadFromJSON.mockReset();

    activeFileMocks.autosaveToActiveFile.mockRejectedValue(
      new Error("Disk autosave failed"),
    );
    activeFileMocks.ensureActiveFileWritable.mockResolvedValue(true);
    activeFileMocks.loadFromActiveFile.mockResolvedValue(null);
    activeFileMocks.persistActiveFileHandle.mockResolvedValue(undefined);
  });

  it("requires opening a file before loading any cached scene on startup", async () => {
    const cachedRectangle = API.createElement({
      id: "cached",
      type: "rectangle",
      x: 10,
      y: 10,
      width: 120,
      height: 80,
    });

    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [cachedRectangle],
        appState: {},
      },
    });

    expect(await screen.findByTestId("startup-file-gate")).toBeTruthy();
    expect(screen.getByTestId("startup-open-file-button")).toBeTruthy();
    expect(window.h.elements).toHaveLength(0);
    expect(window.h.elements.map((element) => element.id)).not.toContain(
      "cached",
    );
  });

  it("keeps the startup gate open when the selected file has no writable handle", async () => {
    jsonMocks.loadFromJSON.mockResolvedValue({
      elements: [],
      appState: {
        fileHandle: null,
      },
      files: {},
      fileAccess: {
        nativeFileSystem: true,
        hasFileHandle: false,
        writePermissionGranted: false,
      },
    });

    await render(<ExcalidrawApp />);

    fireEvent.click(await screen.findByTestId("startup-open-file-button"));

    expect(
      await screen.findByText(/opened without a persistent file handle/i),
    ).toBeTruthy();
    expect(screen.getByTestId("startup-file-gate")).toBeTruthy();
  });

  it("disables the active file after autosave failures once the startup file is opened", async () => {
    const fileHandle = {
      name: "diagram.excalidraw",
      getFile: vi.fn().mockResolvedValue({
        lastModified: Date.UTC(2026, 2, 27, 6, 30, 0),
      }),
    } as unknown as FileSystemFileHandle;
    const rectangle = API.createElement({
      id: "rect",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });

    jsonMocks.loadFromJSON.mockResolvedValue({
      elements: [rectangle],
      appState: {
        fileHandle,
      },
      files: {},
      fileAccess: {
        nativeFileSystem: true,
        hasFileHandle: true,
        writePermissionGranted: true,
      },
    });

    await render(<ExcalidrawApp />);

    fireEvent.click(await screen.findByTestId("startup-open-file-button"));

    await waitFor(() => {
      expect(screen.queryByTestId("startup-file-gate")).toBeNull();
    });

    expect(await screen.findByTestId("last-saved-badge")).toBeTruthy();

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
});
