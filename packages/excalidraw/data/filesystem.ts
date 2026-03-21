import {
  fileOpen as _fileOpen,
  fileSave as _fileSave,
  supported as nativeFileSystemSupported,
} from "browser-fs-access";

import { MIME_TYPES } from "@excalidraw/common";

import { normalizeFile } from "./blob";

type FILE_EXTENSION = Exclude<keyof typeof MIME_TYPES, "binary">;
type PermissionMode = "read" | "readwrite";

export const queryFileHandlePermission = async (
  fileHandle: FileSystemFileHandle,
  mode: PermissionMode,
) => {
  try {
    const permissionQuery = (
      fileHandle as FileSystemFileHandle & {
        queryPermission?: (descriptor: {
          mode: PermissionMode;
        }) => Promise<PermissionState>;
      }
    ).queryPermission;

    if (!permissionQuery) {
      return false;
    }

    return (await permissionQuery.call(fileHandle, { mode })) === "granted";
  } catch (error) {
    console.warn("Failed to query file permission:", error);
    return false;
  }
};

export const requestFileHandlePermission = async (
  fileHandle: FileSystemFileHandle,
  mode: PermissionMode,
) => {
  try {
    const permissionRequest = (
      fileHandle as FileSystemFileHandle & {
        requestPermission?: (descriptor: {
          mode: PermissionMode;
        }) => Promise<PermissionState>;
      }
    ).requestPermission;

    if (!permissionRequest) {
      return false;
    }

    return (await permissionRequest.call(fileHandle, { mode })) === "granted";
  } catch (error) {
    console.warn("Failed to request file permission:", error);
    return false;
  }
};

export const ensureFileHandlePermission = async (
  fileHandle: FileSystemFileHandle | null,
  mode: PermissionMode,
) => {
  if (!nativeFileSystemSupported || !fileHandle) {
    return false;
  }

  if (await queryFileHandlePermission(fileHandle, mode)) {
    return true;
  }

  return requestFileHandlePermission(fileHandle, mode);
};

export const fileOpen = async <M extends boolean | undefined = false>(opts: {
  extensions?: FILE_EXTENSION[];
  description: string;
  multiple?: M;
}): Promise<M extends false | undefined ? File : File[]> => {
  // an unsafe TS hack, alas not much we can do AFAIK
  type RetType = M extends false | undefined ? File : File[];

  const mimeTypes = opts.extensions?.reduce((mimeTypes, type) => {
    mimeTypes.push(MIME_TYPES[type]);

    return mimeTypes;
  }, [] as string[]);

  const extensions = opts.extensions?.reduce((acc, ext) => {
    if (ext === "jpg") {
      return acc.concat(".jpg", ".jpeg");
    }
    return acc.concat(`.${ext}`);
  }, [] as string[]);

  const files = await _fileOpen({
    description: opts.description,
    extensions,
    mimeTypes,
    multiple: opts.multiple ?? false,
  });

  if (Array.isArray(files)) {
    return (await Promise.all(
      files.map((file) => normalizeFile(file)),
    )) as RetType;
  }
  return (await normalizeFile(files)) as RetType;
};

export const fileSave = (
  blob: Blob | Promise<Blob>,
  opts: {
    /** supply without the extension */
    name: string;
    /** file extension */
    extension: FILE_EXTENSION;
    mimeTypes?: string[];
    description: string;
    /** existing FileSystemFileHandle */
    fileHandle?: FileSystemFileHandle | null;
  },
) => {
  return _fileSave(
    blob,
    {
      fileName: `${opts.name}.${opts.extension}`,
      description: opts.description,
      extensions: [`.${opts.extension}`],
      mimeTypes: opts.mimeTypes,
    },
    opts.fileHandle,
    false,
  );
};

export { nativeFileSystemSupported };
