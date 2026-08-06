"use client";

import {useEffect,useRef,useState} from "react";
import * as THREE from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {STLLoader} from "three/examples/jsm/loaders/STLLoader.js";

export default function StlViewer({fileId,fileName}:{fileId:string;fileName:string}){
  const host=useRef<HTMLDivElement>(null);
  const [details,setDetails]=useState("Loading STL…");
  const [error,setError]=useState("");
  useEffect(()=>{
    const container=host.current;if(!container)return;
    const scene=new THREE.Scene();scene.background=new THREE.Color(0x07111f);
    const camera=new THREE.PerspectiveCamera(45,1,0.1,100000);
    const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;container.appendChild(renderer.domElement);
    const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
    scene.add(new THREE.HemisphereLight(0xffffff,0x203040,2.2));
    const key=new THREE.DirectionalLight(0xffffff,2.4);key.position.set(1,2,3);scene.add(key);
    const fill=new THREE.DirectionalLight(0xf5a623,1.2);fill.position.set(-2,-1,1);scene.add(fill);
    const grid=new THREE.GridHelper(200,20,0x38516f,0x1c2c42);scene.add(grid);
    let frame=0,mesh:THREE.Mesh|undefined,disposed=false;
    const resize=()=>{const width=Math.max(container.clientWidth,320),height=Math.max(container.clientHeight,420);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(container);resize();
    const animate=()=>{controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate);};animate();
    fetch(`/api/uploads/${fileId}`,{cache:"no-store"}).then(response=>{if(!response.ok)throw new Error("TITAN could not load this STL file.");return response.arrayBuffer();}).then(buffer=>{
      if(disposed)return;
      const geometry=new STLLoader().parse(buffer);geometry.computeVertexNormals();geometry.computeBoundingBox();
      const box=geometry.boundingBox;if(!box)throw new Error("This STL does not contain viewable geometry.");
      const size=new THREE.Vector3();box.getSize(size);const center=new THREE.Vector3();box.getCenter(center);geometry.translate(-center.x,-center.y,-center.z);
      const material=new THREE.MeshStandardMaterial({color:0xf5a623,roughness:.62,metalness:.08,side:THREE.DoubleSide});
      mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;scene.add(mesh);
      const radius=Math.max(size.length()/2,1);camera.position.set(radius*1.55,radius*1.15,radius*1.55);camera.near=Math.max(radius/1000,.01);camera.far=Math.max(radius*100,1000);camera.updateProjectionMatrix();
      controls.target.set(0,0,0);controls.minDistance=radius*.15;controls.maxDistance=radius*20;controls.update();grid.scale.setScalar(Math.max(radius/100,0.1));
      setDetails(`${fileName} · ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} mm · ${(geometry.attributes.position.count/3).toLocaleString()} triangles`);
    }).catch(reason=>setError(reason instanceof Error?reason.message:"Unable to display this STL."));
    return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();mesh?.geometry.dispose();(mesh?.material as THREE.Material|undefined)?.dispose();renderer.dispose();renderer.domElement.remove();};
  },[fileId,fileName]);
  return <div><div ref={host} className="stlViewer"/>{error?<div className="alert">{error}</div>:<p className="muted">{details}</p>}<p className="muted">Drag to rotate · scroll to zoom · right-drag to pan</p></div>;
}
