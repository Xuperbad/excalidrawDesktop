import { createStore, del, get, set } from "idb-keyval";

import { nativeFileSystemSupported } from "@excalidraw/excalidraw/data/filesystem";
import {
  isImageFileHandle,
  loadFromBlob,
} from "@excalidraw/excalidraw/data/blob";
import { saveAsJSON } from "@excalidraw/excalidraw/data/json";
import { resaveAsImageWithScene } from "@excalidraw/excalidraw/data/resave";
import {
  ensureFileHandlePermission,
  queryFileHandlePermission,
} from "@excalidraw/excalidraw/data/filesystem";

import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";

const activeFileStore = createStore("active-file-db", "active-file-store");
const ACTIVE_FILE_KEY = "lastActiveFileHandle";

export const ACTIVE_FILE_AUTOSAVE_TIMEOUT = 1500;

export const ensureActiveFileWritable = async (
  fileHandle: FileSystemFileHandle | null,
) => {
  return ensureFileHandlePermission(fileHandle, "readwrite");
};

export const persistActiveFileHandle = async (
  fileHandle: FileSystemFileHandle | null,
) => {
  if (!nativeFileSystemSupported) {
    return;
  }

  try {
    if (fileHandle) {
      await set(ACTIVE_FILE_KEY, fileHandle, activeFileStore);
    } else {
      await del(ACTIVE_FILE_KEY, activeFileStore);
    }
  } catch (error) {
    console.warn("Failed to persist active file handle:", error);
  }
};

export const loadFromActiveFile = async ({
  localAppState,
  localElements,
}: {
  localAppState: AppState | null;
  localElements: readonly ExcalidrawElement[] | null;
}): Promise<ImportedDataState | null> => {
  if (!nativeFileSystemSupported) {
    return null;
  }

  let fileHandle: FileSystemFileHandle | null = null;

  try {
    fileHandle =
      (await get<FileSystemFileHandle>(ACTIVE_FILE_KEY, activeFileStore)) ||
      null;
  } catch (error) {
    console.warn("Failed to restore active file handle:", error);
    return null;
  }

  if (!fileHandle) {
    return null;
  }

  if (!(await queryFileHandlePermission(fileHandle, "read"))) {
    return null;
  }

  try {
    const file = await fileHandle.getFile();
    return await loadFromBlob(file, localAppState, localElements, fileHandle);
  } catch (error: any) {
    console.warn("Failed to restore active file:", error);

    if (error?.name === "NotFoundError") {
      await persistActiveFileHandle(null);
    }

    return null;
  }
};

export const autosaveToActiveFile = async ({
  elements,
  appState,
  files,
}: {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
}) => {
  const { fileHandle } = appState;

  if (!nativeFileSystemSupported || !fileHandle) {
    return false;
  }

  const filename = appState.name || "Untitled";

  if (isImageFileHandle(fileHandle)) {
    await resaveAsImageWithScene(
      { elements, appState, files },
      fileHandle,
      filename,
    );
  } else {
    await saveAsJSON({
      data: { elements, appState, files },
      filename,
      fileHandle,
    });
  }

  await persistActiveFileHandle(fileHandle);
  return true;
};
