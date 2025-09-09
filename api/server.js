// server.js - Enhanced with better temporary file cleanup
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 4040;

// Ensure storage folders
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
if (!fs.existsSync("videos")) fs.mkdirSync("videos");

// Store processing status
const processingStatus = new Map();

// Multer config with file size limit
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB limit
  },
});

// Cleanup function for old temporary files
function cleanupTemporaryFiles() {
  try {
    // Clean up old upload files (older than 1 hour)
    const uploadsDir = "uploads";
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      files.forEach((file) => {
        const filePath = path.join(uploadsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.mtime.getTime() < oneHourAgo) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old upload: ${file}`);
          }
        } catch (err) {
          console.error(`Error checking file ${file}:`, err.message);
        }
      });
    }

    // Clean up temporary frame directories (temp_frames_*, temp_stereo_*)
    const currentDir = ".";
    const items = fs.readdirSync(currentDir);
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;

    items.forEach((item) => {
      if (item.startsWith("temp_frames_") || item.startsWith("temp_stereo_")) {
        const itemPath = path.join(currentDir, item);
        try {
          const stats = fs.statSync(itemPath);
          if (stats.isDirectory() && stats.mtime.getTime() < thirtyMinutesAgo) {
            fs.rmSync(itemPath, { recursive: true, force: true });
            console.log(`Cleaned up old temp directory: ${item}`);
          }
        } catch (err) {
          console.error(`Error cleaning temp directory ${item}:`, err.message);
        }
      }
    });

    // Clean up old processed videos (older than 24 hours) - optional
    const videosDir = "videos";
    if (fs.existsSync(videosDir)) {
      const files = fs.readdirSync(videosDir);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      files.forEach((file) => {
        const filePath = path.join(videosDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.mtime.getTime() < oneDayAgo) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old video: ${file}`);
          }
        } catch (err) {
          console.error(`Error checking video ${file}:`, err.message);
        }
      });
    }
  } catch (error) {
    console.error("Error during cleanup:", error);
  }
}

// Run cleanup immediately and then every 30 minutes
cleanupTemporaryFiles();
setInterval(cleanupTemporaryFiles, 30 * 60 * 1000);

// Upload + Convert route
app.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const inputPath = req.file.path;
  const fileName = `${Date.now()}_stereo180.mp4`;
  const outputPath = path.join("videos", fileName);
  const jobId = Date.now().toString();

  // Initialize processing status
  processingStatus.set(jobId, {
    step: "starting",
    message: "Upload received, starting processing...",
    progress: 0,
    fileName: fileName,
    status: "processing",
    inputPath: inputPath, // Store for cleanup
  });

  console.log(`Starting processing for job ${jobId}`);
  console.log(`Input: ${inputPath}, Output: ${outputPath}`);

  // Use spawn instead of exec for better output handling
  const pythonProcess = spawn("python", ["worker.py", inputPath, outputPath]);

  let outputData = "";
  let errorData = "";

  pythonProcess.stdout.on("data", (data) => {
    const output = data.toString();
    outputData += output;

    // Parse progress updates
    const lines = output.split("\n");
    lines.forEach((line) => {
      if (line.startsWith("PROGRESS:")) {
        try {
          const progressData = JSON.parse(line.substring(9));
          processingStatus.set(jobId, {
            ...progressData,
            fileName: fileName,
            status: "processing",
            inputPath: inputPath,
          });
        } catch (e) {
          console.log("Non-JSON output:", line);
        }
      }
    });
  });

  pythonProcess.stderr.on("data", (data) => {
    errorData += data.toString();
    console.error(`Python stderr for job ${jobId}:`, data.toString());
  });

  pythonProcess.on("close", (code) => {
    console.log(`Process for job ${jobId} finished with code: ${code}`);

    // Clean up input file immediately
    try {
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
        console.log(`Cleaned up input file: ${inputPath}`);
      }
    } catch (e) {
      console.error("Input cleanup error:", e);
    }

    if (code === 0) {
      processingStatus.set(jobId, {
        step: "complete",
        message: "VR video ready for download!",
        progress: 100,
        fileName: fileName,
        status: "completed",
      });
      console.log(`Success for job ${jobId}:`, outputData);
    } else {
      console.error(`Process failed for job ${jobId} with code:`, code);
      console.error("Error output:", errorData);

      processingStatus.set(jobId, {
        step: "error",
        message: "Processing failed. Please try again with a smaller video.",
        progress: 0,
        status: "error",
      });

      // Clean up any partial output file
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
          console.log(`Cleaned up partial output: ${outputPath}`);
        }
      } catch (e) {
        console.error("Output cleanup error:", e);
      }
    }

    // Run cleanup after each job completion
    setTimeout(cleanupTemporaryFiles, 5000);
  });

  pythonProcess.on("error", (error) => {
    console.error(`Failed to start python process for job ${jobId}:`, error);

    // Clean up input file on error
    try {
      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
    } catch (e) {
      console.error("Cleanup error:", e);
    }

    processingStatus.set(jobId, {
      step: "error",
      message: "Failed to start processing. Please check server setup.",
      progress: 0,
      status: "error",
    });
  });

  // Return job ID for progress tracking
  res.json({ jobId: jobId, message: "Processing started" });
});

// Progress tracking endpoint
app.get("/progress/:jobId", (req, res) => {
  const jobId = req.params.jobId;
  const status = processingStatus.get(jobId);

  if (!status) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json(status);
});

// Serve processed VR videos
app.use("/videos", express.static(path.join(__dirname, "videos")));

// Download endpoint with proper headers
app.get("/download/:filename", (req, res) => {
  const filename = req.params.filename;
  const videoPath = path.join(__dirname, "videos", filename);

  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: "Video not found" });
  }

  // Get original name without timestamp prefix
  const cleanName = filename.replace(/^\d+_/, "");
  const downloadName = cleanName.replace(".mp4", "_VR180.mp4");

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${downloadName}"`
  );
  res.setHeader("Content-Type", "video/mp4");

  const stream = fs.createReadStream(videoPath);
  stream.pipe(res);

  // Log download for monitoring
  console.log(`Downloaded: ${filename}`);
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// System status endpoint
app.get("/status", (req, res) => {
  try {
    const uploadsCount = fs.existsSync("uploads")
      ? fs.readdirSync("uploads").length
      : 0;
    const videosCount = fs.existsSync("videos")
      ? fs.readdirSync("videos").length
      : 0;

    // Count temporary directories
    const currentDir = ".";
    const items = fs.readdirSync(currentDir);
    const tempDirsCount = items.filter(
      (item) =>
        item.startsWith("temp_frames_") || item.startsWith("temp_stereo_")
    ).length;

    res.json({
      activeJobs: processingStatus.size,
      uploadsCount,
      videosCount,
      tempDirsCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual cleanup endpoint (for debugging)
app.post("/cleanup", (req, res) => {
  try {
    cleanupTemporaryFiles();
    res.json({ message: "Cleanup completed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clean up old processing status (run every hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  let removedCount = 0;

  for (const [jobId, status] of processingStatus.entries()) {
    if (parseInt(jobId) < oneHourAgo) {
      processingStatus.delete(jobId);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`Cleaned up ${removedCount} old processing status records`);
  }
}, 60 * 60 * 1000);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, cleaning up...");
  cleanupTemporaryFiles();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, cleaning up...");
  cleanupTemporaryFiles();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log("🚀 Backend running at http://localhost:" + PORT);
  console.log("🧹 Automatic cleanup enabled");
});
