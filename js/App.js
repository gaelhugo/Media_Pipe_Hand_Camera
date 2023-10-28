import Camera from "./Camera";
import Sender from "./Sender";
export default class App {
  constructor() {
    // getting the video
    this.videoElement = document.querySelector("video");
    this.videoElement.width = window.innerWidth;
    this.videoElement.height = window.innerHeight;

    // getting the main canvas, to extract the pixels
    this.canvasElement = document.querySelector("#canvas");
    this.canvasElement.width = this.videoElement.width + "px";
    this.canvasElement.height = this.videoElement.height + "px";
    this.context = this.canvasElement.getContext("2d");

    // getting the canvas used to paste the generated image
    this.imaginaryCanvas = document.querySelector("#canvas2");
    this.imaginaryCanvas.width = this.videoElement.width;
    this.imaginaryCanvas.height = this.videoElement.height;
    this.imaginaryContext = this.imaginaryCanvas.getContext("2d");

    //getting the prompt
    this.prompt = document.querySelector("#prompt");
    this.prompt.style.width = this.videoElement.width + "px";

    // getting the loader element
    const loader = document.querySelector("template").content.cloneNode(true);
    document.body.appendChild(loader);
    this.loader = document.querySelector("svg");

    // class wrapping up the local call to AUTOMATIC 1111 server
    this.sender = new Sender();
    // initialize camera functionalities
    document.addEventListener("keydown", async (e) => {
      if (e.code === "Backspace") {
        this.imaginaryContext.clearRect(
          0,
          0,
          this.imaginaryCanvas.width,
          this.imaginaryCanvas.height
        );
        this.loader.classList.remove("show");
      }
    });
    // camera functionalities
    this.initializeCamera();
  }

  initializeCamera() {
    this.camera = new Camera(this.videoElement, this.canvasElement);

    this.camera.addEventListener("clicClac", async (e) => {
      // getting the framed image
      const image = await this.camera.crop();
      //put data into imaginary canvas
      this.imaginaryContext.clearRect(
        0,
        0,
        this.imaginaryCanvas.width,
        this.imaginaryCanvas.height
      );
      // set the polaroid frame
      this.imaginaryContext.fillStyle = "white";
      this.imaginaryContext.fillRect(
        image.x - 20,
        image.y - 20,
        image.width + 40,
        image.height + 100
      );
      // copy the extracted image in the overlayed image
      this.imaginaryContext.putImageData(image.data, image.x, image.y);
      const resizeWidth = 512;
      const resizeHeight = parseInt(image.height * (resizeWidth / image.width));
      // show the loader
      this.loader.classList.add("show");
      // center the loader in the frame
      this.loader.style.top = image.y + image.height / 2 - 52 + "px";
      this.loader.style.left = image.x + image.width / 2 - 52 + "px";
      // make the call to AUTOMATIC 1111 server
      const response = await this.sender.postData(
        image.data,
        image.width,
        image.height,
        this.prompt.value,
        this.imaginaryContext
      );
      // get the local result url (using the proxy)
      const url = `http://0.0.0.0:7860/file=${response.data[0][0].name}`;
      const img = new Image();
      img.onload = () => {
        this.loader.classList.remove("show");
        this.imaginaryContext.drawImage(
          img,
          image.x,
          image.y,
          image.width,
          image.height
        );
      };
      img.src = url;
    });
  }
}
