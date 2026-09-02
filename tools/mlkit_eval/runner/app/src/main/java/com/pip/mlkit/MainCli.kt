package com.pip.mlkit

import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Rect
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.common.sdkinternal.MlKitContext
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import kotlin.math.abs

object MainCli {
    @JvmStatic
    fun main(args: Array<String>) {
        println("Initializing Android environment and ML Kit Context...")
        if (android.os.Looper.getMainLooper() == null) {
            android.os.Looper.prepareMainLooper()
        }
        try {
            System.load("/data/local/tmp/lib/libmlkit_google_ocr_pipeline.so")
            println("Native library loaded successfully.")
        } catch (e: Throwable) {
            println("Notice on native lib load: ${e.message}")
        }

        try {
            val activityThreadClass = Class.forName("android.app.ActivityThread")
            val systemMainMethod = activityThreadClass.getMethod("systemMain")
            val currentActivityThread = systemMainMethod.invoke(null)
            val getSystemContextMethod = activityThreadClass.getMethod("getSystemContext")
            val context = getSystemContextMethod.invoke(currentActivityThread) as Context
            MlKitContext.initializeIfNeeded(context)
            println("MlKitContext initialized successfully!")
        } catch (e: Throwable) {
            println("Error initializing MlKitContext: ${e.message}")
            e.printStackTrace()
            return
        }

        val recognizer = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())

        val imagesDir = File("/data/local/tmp/images_test")
        val outputFile = File("/data/local/tmp/images_test/mlkit_results.json")
        val imageFiles = listOf(
            "1000105419.jpg",
            "1000105421.jpg",
            "1000105423.jpg",
            "tngscreenshot.png"
        )

        val rootJson = JSONObject()

        for (filename in imageFiles) {
            val file = File(imagesDir, filename)
            if (!file.exists()) {
                println("File not found: ${file.name}")
                continue
            }

            println("Processing ${file.name} (${file.length()} bytes)...")
            val boundsOptions = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, boundsOptions)
            val maxDim = maxOf(boundsOptions.outWidth, boundsOptions.outHeight)
            var sampleSize = 1
            while (maxDim / (sampleSize * 2) >= 1200) {
                sampleSize *= 2
            }
            val decodeOptions = BitmapFactory.Options().apply {
                inSampleSize = sampleSize
            }
            val bitmap = BitmapFactory.decodeFile(file.absolutePath, decodeOptions)
            if (bitmap == null) {
                println("Failed to decode bitmap: ${file.name}")
                continue
            }
            println("  Decoded bitmap: ${bitmap.width}x${bitmap.height} (sampleSize=$sampleSize)")

            val inputImage = InputImage.fromBitmap(bitmap, 0)
            val t0 = System.nanoTime()
            val textResult = Tasks.await(recognizer.process(inputImage))
            val latencyMs = (System.nanoTime() - t0) / 1_000_000.0
            println("  Done in ${latencyMs} ms. Found ${textResult.textBlocks.size} blocks.")

            data class LineInfo(val text: String, val box: Rect?, val top: Int, val left: Int, val bottom: Int)
            val allLines = mutableListOf<LineInfo>()

            val blocksArray = JSONArray()
            for (block in textResult.textBlocks) {
                val blockJson = JSONObject()
                blockJson.put("text", block.text)
                block.boundingBox?.let { b ->
                    blockJson.put("box", JSONObject().apply {
                        put("left", b.left)
                        put("top", b.top)
                        put("right", b.right)
                        put("bottom", b.bottom)
                    })
                }

                val linesArray = JSONArray()
                for (line in block.lines) {
                    val lineJson = JSONObject()
                    lineJson.put("text", line.text)
                    val b = line.boundingBox
                    if (b != null) {
                        lineJson.put("box", JSONObject().apply {
                            put("left", b.left)
                            put("top", b.top)
                            put("right", b.right)
                            put("bottom", b.bottom)
                        })
                        allLines.add(LineInfo(line.text, b, b.top, b.left, b.bottom))
                    } else {
                        allLines.add(LineInfo(line.text, null, 0, 0, 0))
                    }
                    linesArray.put(lineJson)
                }
                blockJson.put("lines", linesArray)
                blocksArray.put(blockJson)
            }

            // Spatial line grouping:
            allLines.sortBy { it.top }
            val rows = mutableListOf<MutableList<LineInfo>>()
            for (line in allLines) {
                var placed = false
                for (row in rows) {
                    val avgTop = row.map { it.top }.average()
                    val avgHeight = row.map { it.bottom - it.top }.average()
                    val threshold = if (avgHeight > 0) avgHeight * 0.6 else 15.0
                    if (abs(line.top - avgTop) < threshold) {
                        row.add(line)
                        placed = true
                        break
                    }
                }
                if (!placed) {
                    rows.add(mutableListOf(line))
                }
            }

            val spatialLines = mutableListOf<String>()
            for (row in rows) {
                row.sortBy { it.left }
                spatialLines.add(row.joinToString("    ") { it.text })
            }
            val spatialText = spatialLines.joinToString("\n")

            val imgJson = JSONObject().apply {
                put("file", filename)
                put("width", bitmap.width)
                put("height", bitmap.height)
                put("latency_ms", latencyMs)
                put("raw_text", textResult.text)
                put("spatial_text", spatialText)
                put("blocks", blocksArray)
            }

            rootJson.put(filename, imgJson)
            bitmap.recycle()
        }

        FileOutputStream(outputFile).use { fos ->
            fos.write(rootJson.toString(2).toByteArray(Charsets.UTF_8))
        }

        println("SUCCESS: Results saved to ${outputFile.absolutePath}")
    }
}
