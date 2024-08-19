import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import * as THREE from 'three';
import { OrbitControls } from 'three-orbitcontrols-ts';

const NetworkBubbles: React.FC = () => {
  const [connections, setConnections] = useState<any[]>([]);
  const [connectionCounts, setConnectionCounts] = useState<{ [key: string]: number }>({});
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null); //Stato per il filtro
  const bubblesRef = useRef<THREE.Mesh[]>([]); //Riferimento alle bolle
  const sceneRef = useRef<THREE.Scene | null>(null); //Riferimento alla scena

  useEffect(() => {
    const fetchConnections = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:5000/connections');
        console.log("Connessioni caricate:", response.data);
        setConnections(response.data);
      } catch (error) {
        console.error('Errore nel recupero delle connessioni:', error);
      }
    };

    //Polling dei dati ogni 5 secondi
    fetchConnections(); //Prima chiamata immediata
    const intervalId = setInterval(fetchConnections, 5000);

    return () => clearInterval(intervalId); //Pulizia dell'intervallo al termine del componente
  }, []);

  const getBubbleColor = useCallback((status: string): THREE.Color => {
    switch (status) {
      case 'ESTABLISHED':
        return new THREE.Color(0x00ff00); 
      case 'LISTEN':
        return new THREE.Color(0x0000ff); 
      case 'CLOSE_WAIT':
        return new THREE.Color(0xff0000); 
      case 'SYN_SENT':
        return new THREE.Color(0xffff00); 
      case 'SYN_RECV':
        return new THREE.Color(0xff00ff); 
      case 'FIN_WAIT1':
      case 'FIN_WAIT2':
        return new THREE.Color(0x00ffff); 
      case 'TIME_WAIT':
        return new THREE.Color(0xffa500); 
      case 'CLOSING':
        return new THREE.Color(0x8b00ff); 
      case 'LAST_ACK':
        return new THREE.Color(0x008b8b); 
      default:
        return new THREE.Color(0x888888); 
    }
  }, []);

  const countConnectionsByStatus = (connections: any[]) => {
    const counts: { [key: string]: number } = {};
    connections.forEach(conn => {
      counts[conn.status] = (counts[conn.status] || 0) + 1;
    });
    setConnectionCounts(counts);
  };

  const clearBubbles = useCallback((scene: THREE.Scene) => {
    bubblesRef.current.forEach(bubble => {
      scene.remove(bubble); //Rimuovi le bolle dalla scena
    });
    bubblesRef.current = []; //Svuota il riferimento alle bolle
  }, []);

  const syncBubblesWithConnections = useCallback((newConnections: any[], scene: THREE.Scene) => {
    clearBubbles(scene); //Rimuovi tutte le bolle esistenti prima di aggiungere quelle nuove

    //Aggiungi nuove bolle per le connessioni che corrispondono allo stato selezionato
    newConnections.forEach(conn => {
      if (selectedStatus && conn.status !== selectedStatus) {
        return; //Salta le connessioni che non corrispondono allo stato selezionato
      }

      const radius = Math.random() * 3 + 1;
      const bubbleGeometry = new THREE.SphereGeometry(radius, 32, 32);
      const bubbleMaterial = new THREE.MeshStandardMaterial({
        color: getBubbleColor(conn.status),
        transparent: true,
        opacity: 0.8,
      });
      const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);

      // Posizionamento casuale delle bolle
      bubble.position.x = Math.random() * 100 - 50;
      bubble.position.y = Math.random() * 100 - 50;
      bubble.position.z = Math.random() * 100 - 50;

      console.log("Aggiungo bolla:", conn);

      bubble.userData = { connection: conn }; //Memorizza i dati della connessione nella bolla

      scene.add(bubble);
      bubblesRef.current.push(bubble); //Aggiungi alla lista delle bolle
    });
  }, [getBubbleColor, clearBubbles, selectedStatus]);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 
    sceneRef.current = scene; //Memorizza il riferimento alla scena

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 200; //Posizione camera

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    document.getElementById('scene-container')?.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(bubblesRef.current);

      if (intersects.length > 0) {
        const bubble = intersects[0].object as THREE.Mesh;
        const connection = bubble.userData.connection;
        alert(`Status: ${connection.status}, local IP: ${connection.local_address}, Local Port: ${connection.local_port}`);
      }
    };

    window.addEventListener('click', onMouseClick, false);

    const animate = () => {
      requestAnimationFrame(animate);
      bubblesRef.current.forEach(bubble => {
        bubble.position.x += (Math.random() - 0.5) * 0.2;
        bubble.position.y += (Math.random() - 0.5) * 0.2;
        bubble.position.z += (Math.random() - 0.5) * 0.2;
      });
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      renderer.dispose();
      document.getElementById('scene-container')?.removeChild(renderer.domElement);
      window.removeEventListener('click', onMouseClick);
    };
  }, []);

  useEffect(() => {
    if (connections.length > 0 && sceneRef.current) {
      console.log("Sincronizzazione delle bolle con le connessioni");
      syncBubblesWithConnections(connections, sceneRef.current);
      countConnectionsByStatus(connections); //Conta le connessioni per stato
    }
  }, [connections, selectedStatus, syncBubblesWithConnections]);

  const handleStatusClick = (status: string) => {
    setSelectedStatus(selectedStatus === status ? null : status); 
  };

  const handleShowAllClick = () => {
    setSelectedStatus(null); //Resetta il filtro per mostrare tutte le bolle
  };

  return (
    <div id="scene-container">
      <div className="legend">
        <h3>Legend</h3>
        <ul>
          <li onClick={() => handleStatusClick('ESTABLISHED')} style={{ cursor: 'pointer', color: selectedStatus === 'ESTABLISHED' ? '#00ff00' : '#ffffff' }}>
            <span style={{ backgroundColor: '#00ff00' }}></span>ESTABLISHED ({connectionCounts['ESTABLISHED'] || 0})
          </li>
          <li onClick={() => handleStatusClick('LISTEN')} style={{ cursor: 'pointer', color: selectedStatus === 'LISTEN' ? '#0000ff' : '#ffffff' }}>
            <span style={{ backgroundColor: '#0000ff' }}></span>LISTEN ({connectionCounts['LISTEN'] || 0})
          </li>
          <li onClick={() => handleStatusClick('CLOSE_WAIT')} style={{ cursor: 'pointer', color: selectedStatus === 'CLOSE_WAIT' ? '#ff0000' : '#ffffff' }}>
            <span style={{ backgroundColor: '#ff0000' }}></span>CLOSE_WAIT ({connectionCounts['CLOSE_WAIT'] || 0})
          </li>
          <li onClick={() => handleStatusClick('SYN_SENT')} style={{ cursor: 'pointer', color: selectedStatus === 'SYN_SENT' ? '#ffff00' : '#ffffff' }}>
            <span style={{ backgroundColor: '#ffff00' }}></span>SYN_SENT ({connectionCounts['SYN_SENT'] || 0})
          </li>
          <li onClick={() => handleStatusClick('SYN_RECV')} style={{ cursor: 'pointer', color: selectedStatus === 'SYN_RECV' ? '#ff00ff' : '#ffffff' }}>
            <span style={{ backgroundColor: '#ff00ff' }}></span>SYN_RECV ({connectionCounts['SYN_RECV'] || 0})
          </li>
          <li onClick={() => handleStatusClick('FIN_WAIT1')} style={{ cursor: 'pointer', color: selectedStatus === 'FIN_WAIT1' ? '#00ffff' : '#ffffff' }}>
            <span style={{ backgroundColor: '#00ffff' }}></span>FIN_WAIT1 ({connectionCounts['FIN_WAIT1'] || 0})
          </li>
          <li onClick={() => handleStatusClick('FIN_WAIT2')} style={{ cursor: 'pointer', color: selectedStatus === 'FIN_WAIT2' ? '#00ffff' : '#ffffff' }}>
            <span style={{ backgroundColor: '#00ffff' }}></span>FIN_WAIT2 ({connectionCounts['FIN_WAIT2'] || 0})
          </li>
          <li onClick={() => handleStatusClick('TIME_WAIT')} style={{ cursor: 'pointer', color: selectedStatus === 'TIME_WAIT' ? '#ffa500' : '#ffffff' }}>
            <span style={{ backgroundColor: '#ffa500' }}></span>TIME_WAIT ({connectionCounts['TIME_WAIT'] || 0})
          </li>
          <li onClick={() => handleStatusClick('CLOSING')} style={{ cursor: 'pointer', color: selectedStatus === 'CLOSING' ? '#8b00ff' : '#ffffff' }}>
            <span style={{ backgroundColor: '#8b00ff' }}></span>CLOSING ({connectionCounts['CLOSING'] || 0})
          </li>
          <li onClick={() => handleStatusClick('LAST_ACK')} style={{ cursor: 'pointer', color: selectedStatus === 'LAST_ACK' ? '#008b8b' : '#ffffff' }}>
            <span style={{ backgroundColor: '#008b8b' }}></span>LAST_ACK ({connectionCounts['LAST_ACK'] || 0})
          </li>
          <li onClick={() => handleStatusClick('DEFAULT')} style={{ cursor: 'pointer', color: selectedStatus === 'DEFAULT' ? '#888888' : '#ffffff' }}>
            <span style={{ backgroundColor: '#888888' }}></span>Other Status ({connectionCounts['DEFAULT'] || 0})
          </li>
        </ul>
        <button onClick={handleShowAllClick} style={{ marginTop: '10px', padding: '5px 10px', cursor: 'pointer' }}>
          Show All
        </button>
      </div>
    </div>
  );
};

export default NetworkBubbles;
