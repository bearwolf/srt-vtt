
const video = document.querySelector("video");
const track = document.querySelector("track");
let cues = [];
let currentCueIndex = 0;
let currentVTTContent;
let currentSRTContent = "";
let originalVttStructure = null;
const controls = [
  "linePosition",
  "alignment",
  "textSize",
  "textColor",
  "bgColor",
];

video.textTracks[0].mode = "showing";

track.addEventListener("load", () => {
  cues = Array.from(track.track.cues);

  const maxTime = Math.max(...cues.map((cue) => cue.endTime));

  video._customDuration = maxTime + 1;

  if (cues.length > 0) {
    showCue(0);
  }
});

function showCue(index) {
  console.log("=== showCue called ===");
  console.log("Setting currentCueIndex from", currentCueIndex, "to", index);

  if (index < 0 || index >= cues.length) {
    console.log("Invalid index");
    return;
  }

  currentCueIndex = index;
  const cue = cues[index];
  console.log("Cue text:", cue.text.substring(0, 30));

  try {
    const track = video.textTracks[0];
    track.mode = "showing";

    const activeCueTime = (index % 50) * 0.1;

    Array.from(track.cues).forEach((c, i) => {
      if (i === index) {
        console.log("Activating cue", i);
        c.startTime = activeCueTime;
        c.endTime = activeCueTime + 0.05;
      } else {
        const inactiveTime = (i % 50) * 0.1 + 0.06;
        c.startTime = inactiveTime;
        c.endTime = inactiveTime + 0.001;
      }
    });

    video.currentTime = activeCueTime + 0.01;
    console.log("video.currentTime set to:", video.currentTime);
  } catch (e) {
    console.error("Error showing cue:", e);
  }
}

fetch(track.src)
  .then((response) => response.text())
  .then((text) => {
    originalVttStructure = parseVttStructure(text);
    currentVTTContent = text;
    currentUpdatedVTT = text;
  });

function parseVttStructure(vttContent) {
  const blocks = vttContent.split("\n\n");
  const header = blocks[0];
  let styleBlock = "";
  let cueBlocks = blocks.slice(1);

  const styleIndex = cueBlocks.findIndex((block) =>
    block.trim().startsWith("STYLE"),
  );
  if (styleIndex !== -1) {
    styleBlock = cueBlocks[styleIndex];
    cueBlocks = cueBlocks.filter((_, index) => index !== styleIndex);
  }

  const cues = cueBlocks
    .filter((block) => block.includes("-->"))
    .map((block) => {
      const lines = block.split("\n");
      const timeCodeLine = lines[0];
      const text = lines.slice(1).join("\n");
      return {
        timecode:
          timeCodeLine.split(" ")[0] + " --> " + timeCodeLine.split(" ")[2],
        text: text,
      };
    });

  return { header, styleBlock, cues };
}

controls.forEach((controlId) => {
  const element = document.getElementById(controlId);
  if (element) {
    element.addEventListener("change", updateSubtitles);
  }
});
function getStyleValues() {
  const values = {};
  controls.forEach((controlId) => {
    const element = document.getElementById(controlId);
    if (element) {
      values[controlId] = element.value;
    }
  });
  return values;
}

document.getElementById("nextCue").addEventListener("click", () => {
  console.log("=== NEXT BUTTON ===");
  console.log("Current index:", currentCueIndex);
  console.log("Total cues:", cues.length);
  console.log("Current cue:", cues[currentCueIndex]);

  if (currentCueIndex < cues.length - 1) {
    const nextIndex = currentCueIndex + 1;
    console.log("Going to index:", nextIndex);
    console.log("Next cue:", cues[nextIndex]);
    showCue(nextIndex);
  } else {
    console.log("Already at last cue");
  }
});

document.getElementById("prevCue").addEventListener("click", () => {
  console.log("=== PREV BUTTON ===");
  console.log("Current index:", currentCueIndex);
  console.log("Total cues:", cues.length);

  if (currentCueIndex > 0) {
    const prevIndex = currentCueIndex - 1;
    console.log("Going to index:", prevIndex);
    console.log("Prev cue:", cues[prevIndex]);
    showCue(prevIndex);
  } else {
    console.log("Already at first cue");
  }
});

video.addEventListener("loadedmetadata", () => {
  video.pause();
  if (cues.length > 0) {
    showCue(0);
  }
});

function convertSrtToVtt(
  srtContent,
  linePos,
  alignment,
  size = "100%",
  color = "white",
  bgColor = "rgba(0,0,0,0.50)",
) {
  let vttContent = "WEBVTT\n\n";

  vttContent += "STYLE\n::cue {\n";
  vttContent += `  background-color: ${bgColor};\n`;
  vttContent += "}\n\n";

  const blocks = srtContent
    .trim()
    .split(/\r?\n\r?\n/)
    .filter((block) => block.trim());

  blocks.forEach((block) => {
    const lines = block.split(/\r?\n/);
    if (lines.length >= 2) {
      const timecode =
        lines[1].replace(/,/g, ".").trim() +
        ` ${linePos} ${alignment} size:${size}`;

      const textLines = lines.slice(2);
      vttContent += `${timecode}\n${textLines.join("\n")}\n\n`;
    }
  });

  return vttContent;
}

function updateVttStyling(
  vttContent,
  linePos,
  alignment,
  size = "100%",
  color = "white",
  bgColor = "rgba(0,0,0,0.50)",
) {
  if (!originalVttStructure) return vttContent;

  let newVtt = originalVttStructure.header + "\n\n";

  newVtt += "STYLE\n::cue {\n";
  newVtt += `  background-color: ${bgColor};\n`;
  newVtt += "}\n\n";

  originalVttStructure.cues.forEach((cue) => {
    const timeCodeWithStyle = `${cue.timecode} ${linePos} ${alignment} size:${size}`;
    newVtt += `${timeCodeWithStyle}\n${cue.text}\n\n`;
  });

  return newVtt;
}

document.getElementById("srtInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    currentFileName = file.name.replace(/\.(srt|vtt)$/i, "");
    const text = await file.text();
    let vttContent;

    if (file.name.toLowerCase().endsWith(".vtt")) {
      if (!validateVttFile(text)) {
        throw Error("Ogiltig VTT-fil: Felaktigt format");
      }
      originalVttStructure = parseVttStructure(text);
      vttContent = text;
    } else if (file.name.toLowerCase().endsWith(".srt")) {
      currentSRTContent = text;
      const styleValues = getStyleValues();
      vttContent = convertSrtToVtt(
        text,
        styleValues.linePosition,
        styleValues.alignment,
        styleValues.textSize,
        styleValues.textColor,
        styleValues.bgColor,
      );
      originalVttStructure = parseVttStructure(vttContent);
    }

    currentVTTContent = vttContent;
    currentUpdatedVTT = vttContent;
    while (track.track.cues && track.track.cues.length > 0) {
      track.track.removeCue(track.track.cues[0]);
    }
    const blob = new Blob([vttContent], { type: "text/vtt" });
    const newTrackUrl = URL.createObjectURL(blob);
    track.src = newTrackUrl;
  } catch (error) {
    console.error("Error processing file:", error);
    alert(error.message || "Ett fel uppstod när filen skulle läsas in");
  }
});

function updateSubtitles() {
  if (!originalVttStructure) {
    console.log("No VTT structure available");
    return;
  }

  const styleValues = getStyleValues();
  console.log("Style values:", styleValues);

  const newVTT = updateVttStyling(
    currentVTTContent,
    styleValues.linePosition,
    styleValues.alignment,
    styleValues.textSize,
    styleValues.textColor,
    styleValues.bgColor,
  );

  console.log("New VTT content:", newVTT);

  currentUpdatedVTT = newVTT;
  currentVTTContent = newVTT;

  const blob = new Blob([newVTT], { type: "text/vtt" });
  const newTrackUrl = URL.createObjectURL(blob);
  track.src = newTrackUrl;
}

function validateVttFile(content) {
  if (!content.trim().startsWith("WEBVTT")) {
    return false;
  }

  const blocks = content.trim().split("\n\n");
  if (blocks.length < 2) {
    return false;
  }

  const timePattern = /^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/;
  let hasValidTimecode = false;

  for (const block of blocks) {
    if (block.trim().startsWith("STYLE")) {
      continue;
    }
    if (timePattern.test(block)) {
      hasValidTimecode = true;
      break;
    }
  }

  return hasValidTimecode;
}

document.getElementById("downloadVTT").addEventListener("click", () => {
  if (!currentUpdatedVTT) return;

  const blob = new Blob([currentUpdatedVTT], { type: "text/vtt" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;

  a.download = currentFileName ? `${currentFileName}.vtt` : "subtitles.vtt";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
});

function previewVTT(vttContent) {
  const video = document.createElement("video");
  video.controls = true;
  video.width = 253;
  video.height = 450;

  const track = document.createElement("track");
  track.kind = "subtitles";
  track.label = "Svenska";
  track.srclang = "sv";
  track.src = "path/to/subtitles.vtt";
  track.default = true;

  video.appendChild(track);
  return video;
}

document.addEventListener("DOMContentLoaded", function () {
  document.body.classList.remove("fadeOutAnimation");
});

window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    document.body.classList.remove("fadeOutAnimation");
  }
});
