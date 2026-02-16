/**
 * Download USFX zip files from eBible.org and extract the XML.
 *
 * Downloads are cached in scripts/seed-bible/.data/ so repeated runs
 * skip the download if the file already exists (delete .data/ to force).
 */

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createUnzip } from "node:zlib";
import {
  DOWNLOAD_DIR,
  getUsfxDownloadUrl,
  getUsfxFilename,
  type TranslationSource,
} from "./config.js";

/**
 * Ensure the download directory exists.
 */
async function ensureDownloadDir(): Promise<void> {
  await fsp.mkdir(DOWNLOAD_DIR, { recursive: true });
}

/**
 * Download the USFX zip for a single translation, extract the XML file,
 * and return the path to the extracted XML.
 */
export async function downloadAndExtractUsfx(
  translation: TranslationSource
): Promise<string> {
  await ensureDownloadDir();

  const zipUrl = getUsfxDownloadUrl(translation.ebibleId);
  const xmlFilename = getUsfxFilename(translation.ebibleId);
  const xmlPath = path.join(DOWNLOAD_DIR, xmlFilename);
  const zipPath = path.join(DOWNLOAD_DIR, `${translation.ebibleId}_usfx.zip`);

  // Skip download if XML already exists
  if (fs.existsSync(xmlPath)) {
    console.log(`  [cached] ${xmlFilename} already exists, skipping download.`);
    return xmlPath;
  }

  // Download the zip
  console.log(`  Downloading ${zipUrl} ...`);
  const response = await fetch(zipUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download ${zipUrl}: ${response.status} ${response.statusText}`
    );
  }

  // Write zip to disk
  const arrayBuffer = await response.arrayBuffer();
  await fsp.writeFile(zipPath, Buffer.from(arrayBuffer));
  console.log(`  Saved zip to ${zipPath} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB)`);

  // Extract using the built-in unzip utility
  // Node.js doesn't have a built-in zip extractor, so we use a simple approach:
  // We'll use the `unzip` command if available, otherwise fall back to a manual approach.
  console.log(`  Extracting ${xmlFilename} from zip...`);

  try {
    // Try using system unzip command (available on macOS, Linux, most servers)
    const { execSync } = await import("node:child_process");
    execSync(`unzip -o "${zipPath}" -d "${DOWNLOAD_DIR}"`, {
      stdio: "pipe",
    });
  } catch {
    // Fallback: use Node.js built-in (requires reading zip manually)
    // For zip files, we need a proper unzip. Let's try with tar if it's a .tar.gz
    // or use a simple approach for zip format.
    console.log("  System unzip not available. Trying alternative extraction...");
    await extractZipManual(zipPath, DOWNLOAD_DIR);
  }

  // Verify extraction
  if (!fs.existsSync(xmlPath)) {
    // The XML might have a different name inside the zip. List what was extracted.
    const files = await fsp.readdir(DOWNLOAD_DIR);
    const xmlFiles = files.filter((f) => f.endsWith(".xml"));
    if (xmlFiles.length > 0) {
      // Rename to expected name
      const extractedXml = path.join(DOWNLOAD_DIR, xmlFiles[0]);
      await fsp.rename(extractedXml, xmlPath);
      console.log(`  Renamed ${xmlFiles[0]} -> ${xmlFilename}`);
    } else {
      throw new Error(
        `Extraction failed: could not find XML file in ${DOWNLOAD_DIR}. Files found: ${files.join(", ")}`
      );
    }
  }

  // Clean up zip file
  await fsp.unlink(zipPath).catch(() => {});

  console.log(`  Extracted ${xmlFilename} successfully.`);
  return xmlPath;
}

/**
 * Minimal manual zip extraction fallback.
 * Uses the decompress-style approach by reading the zip central directory.
 * This handles the common case of a single-file zip from eBible.org.
 */
async function extractZipManual(
  zipPath: string,
  outputDir: string
): Promise<void> {
  // Read the zip file
  const zipBuffer = await fsp.readFile(zipPath);

  // Find local file headers (PK\x03\x04)
  let offset = 0;
  while (offset < zipBuffer.length - 4) {
    if (
      zipBuffer[offset] === 0x50 &&
      zipBuffer[offset + 1] === 0x4b &&
      zipBuffer[offset + 2] === 0x03 &&
      zipBuffer[offset + 3] === 0x04
    ) {
      // Parse local file header
      const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
      const compressedSize = zipBuffer.readUInt32LE(offset + 18);
      const uncompressedSize = zipBuffer.readUInt32LE(offset + 22);
      const filenameLength = zipBuffer.readUInt16LE(offset + 26);
      const extraFieldLength = zipBuffer.readUInt16LE(offset + 28);
      const filename = zipBuffer
        .subarray(offset + 30, offset + 30 + filenameLength)
        .toString("utf8");

      const dataStart = offset + 30 + filenameLength + extraFieldLength;

      if (filename.endsWith(".xml")) {
        let fileData: Buffer;

        if (compressionMethod === 0) {
          // Stored (no compression)
          fileData = Buffer.from(
            zipBuffer.subarray(dataStart, dataStart + uncompressedSize)
          );
        } else if (compressionMethod === 8) {
          // Deflate
          const { inflateRawSync } = await import("node:zlib");
          const compressedData = zipBuffer.subarray(
            dataStart,
            dataStart + compressedSize
          );
          fileData = inflateRawSync(compressedData);
        } else {
          throw new Error(
            `Unsupported compression method ${compressionMethod} for ${filename}`
          );
        }

        const outputPath = path.join(outputDir, path.basename(filename));
        await fsp.writeFile(outputPath, fileData);
        console.log(`  Extracted ${filename} (${(fileData.length / 1024 / 1024).toFixed(1)} MB)`);
      }

      // Move to next entry
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }
}
