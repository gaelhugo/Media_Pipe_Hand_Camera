// modules from mediaPipe

import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import EventEmitter from "@onemorestudio/eventemitterjs";
export default class Camera extends EventEmitter {
  constructor(videoElement, canvas) {
    super();
    this.sound = new Audio("./sound/camera-shutter-6305.mp3");
    this._handLandmarker = undefined;
    this.webcamRunning = true;
    this.video = videoElement;
    this.canvasElement = canvas;
    this.canvasCtx = this.canvasElement.getContext("2d");
    this.lastVideoTime = -1;
    this.results = undefined;

    // Check if webcam access is supported.
    this.hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

    this.createHandLandmarker();
  }

  async createHandLandmarker() {
    const vision = await FilesetResolver.forVisionTasks("./tasks/wasm");
    this._handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `./tasks/hand_landmarker.task`,
        delegate: "GPU",
      },
      runningMode: "VIDEO", // this.runningMode,
      numHands: 2,
    });
    this.enableCam();
  }

  enableCam(e) {
    if (!this._handLandmarker) {
      console.log("Wait! objectDetector not loaded yet.");
      return;
    }
    // getUsermedia parameters.
    const constraints = {
      video: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      this.video.srcObject = stream;
      this.video.addEventListener("loadeddata", this.predictWebcam.bind(this));
    });
  }

  crop() {
    //    get image data from canvas and crop it
    // store coord and dimensions of rectangle
    this.sound.play();
    return new Promise((resolve, reject) => {
      const rect = {
        x: this.topLeftPoint.x * this.canvasElement.width,
        y: this.topLeftPoint.y * this.canvasElement.height,
        width: this.width * this.canvasElement.width,
        height: this.height * this.canvasElement.height,
      };

      // set a little timeout to let the user remove the hand
      setTimeout(() => {
        const imageData = this.canvasCtx.getImageData(
          rect.x,
          rect.y,
          rect.width,
          rect.height
        );
        resolve({
          data: imageData,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      }, 1000);
    });
  }

  // get the prediction
  async predictWebcam() {
    this.canvasElement.style.width = this.video.videoWidth;
    this.canvasElement.style.height = this.video.videoHeight;
    this.canvasElement.width = this.video.videoWidth;
    this.canvasElement.height = this.video.videoHeight;

    let startTimeMs = performance.now();
    if (this.lastVideoTime !== this.video.currentTime) {
      this.lastVideoTime = this.video.currentTime;
      this.results = this._handLandmarker.detectForVideo(
        this.video,
        startTimeMs
      );
    }

    this.canvasCtx.save();
    this.canvasCtx.scale(-1, 1); // Inverse l'image horizontalement
    this.canvasCtx.drawImage(
      this.video,
      -this.video.videoWidth,
      0,
      this.video.videoWidth,
      this.video.videoHeight
    );
    this.canvasCtx.restore();
    this.canvasCtx.save();

    if (this.results.landmarks && this.results.landmarks.length > 0) {
      // only happen if we have a second hand
      if (this.results.landmarks[1]) {
        //get max distance 2 identified fingers
        const [point0, point12] = [
          this.results.landmarks[1][8],
          this.results.landmarks[1][4],
        ];
        // define a max distance (hand open)
        if (!this.max_distance) {
          this.max_distance = Math.sqrt(
            Math.pow(point0.x - point12.x, 2) +
              Math.pow(point0.y - point12.y, 2)
          );
        }
        // get distance and normalize it by the max distance
        const distance =
          Math.sqrt(
            Math.pow(point0.x - point12.x, 2) +
              Math.pow(point0.y - point12.y, 2)
          ) / this.max_distance;

        // if the distance is small enough, we take a picture
        // the next picture is authorized only 5 sec later
        if (distance < 0.5 && !this.photoTaken) {
          console.log("take a picture", distance);
          this.photoTaken = true;
          this.emit("clicClac", []);
          clearTimeout(this.t);
          this.t = setTimeout(() => {
            this.photoTaken = false;
          }, 5000);
        } else if (distance > 0.5 && this.photoTaken) {
          // this.photoTaken = false;
        }
      }

      // get rectangle dimensions (the FRAME)
      const [point1, point2] = [
        this.results.landmarks[0][4],
        this.results.landmarks[0][8],
      ];
      const leftPoint = point1.x > point2.x ? point1 : point2;
      const bottomPoint = point1.y < point2.y ? point2 : point1;
      this.width = Math.abs(point1.x - point2.x);
      this.height = Math.abs(point1.y - point2.y);
      this.topLeftPoint = {
        x: 1 - leftPoint.x,
        y:
          bottomPoint === point1
            ? point1.y - this.height
            : point2.y - this.height,
      };

      // draw rectangle (the frame)
      this.canvasCtx.beginPath();
      this.canvasCtx.rect(
        this.topLeftPoint.x * this.canvasElement.width,
        this.topLeftPoint.y * this.canvasElement.height,
        this.width * this.canvasElement.width,
        this.height * this.canvasElement.height
      );
      this.canvasCtx.strokeStyle = "#ffffff";
      this.canvasCtx.stroke();
    } else {
      // no distance
      this.max_distance = null;
    }

    this.canvasCtx.restore();

    if (this.webcamRunning === true) {
      requestAnimationFrame(this.predictWebcam.bind(this));
    }
  }
}
