import { loadGLTF } from 'https://cdn.jsdelivr.net/npm/mind-ar@1.1.4/examples/utils/loader.js';

const mindarThree = new window.MINDAR.IMAGE.MindARThree({
    container: document.querySelector("#ar-container"),
    imageTargetSrc: "./targets.mind",
});

const { renderer, scene, camera } = mindarThree;
const anchor = mindarThree.addAnchor(0);

const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
scene.add(light);

let gltf;

const start = async () => {
    console.log("MindAR starting...");
    await mindarThree.start();
    console.log("MindAR started");
    renderer.setAnimationLoop(() => {
        if (gltf) {
            gltf.scene.rotation.y += 0.01;
        }
        renderer.render(scene, camera);
    });
};

loadGLTF("./logo_biomechanics.glb")
    .then(result => {
        console.log("GLTF loaded");
        gltf = result;
        gltf.scene.scale.set(0.2, 0.2, 0.2);
        anchor.group.add(gltf.scene);
    })
    .catch(err => {
        console.error("Error loading GLTF:", err);
    });

start();
