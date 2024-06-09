import React, { useEffect, useState, useRef } from 'react';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-codes.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import 'bpmn-js-embedded-comments/assets/comments.css';
import '@bpmn-io/properties-panel/assets/properties-panel.css';
import 'diagram-js-minimap/assets/diagram-js-minimap.css';

import minimapModule from 'diagram-js-minimap';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import {
    BpmnPropertiesPanelModule,
    BpmnPropertiesProviderModule,
    // CamundaPlatformPropertiesProviderModule
} from 'bpmn-js-properties-panel';
import CamundaBpmnModdle from 'camunda-bpmn-moddle/resources/camunda.json';
import EmbeddedComments from 'bpmn-js-embedded-comments';
import ColorPickerModule from 'bpmn-js-color-picker';

import tagPropertiesProviderModule from './providers/tags';
import tagModdleDescriptor from './descriptors/tags';
import conditionPropertiesProviderModule from './providers/conditions';
import conditionModdleDescriptor from './descriptors/conditions';

import { downloadJSON, downloadXML } from './utils/Downloader';
import { jsonToXml, xmlToJson } from './utils/xml2json';
import { RestClient } from './utils/RestClient';

import DeployDiagram from './DeploymentForm';
import ErrorPanel from './ErrorPanel';

import './style/CamundaModeler.css';
import './style/comments.css';

const CamundaModeler = () => {
    const bpmnModelerRef = useRef(null);
    const propertiesPanelRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isOpen, setOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [errorOccured, setErrorOccured] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        try {
            bpmnModelerRef.current = new BpmnModeler({
                container: '#bpmnview',
                propertiesPanel: {
                    parent: '#propertiesview'
                },
                additionalModules: [
                    BpmnPropertiesPanelModule,
                    BpmnPropertiesProviderModule,
                    tagPropertiesProviderModule,
                    conditionPropertiesProviderModule,
                    // CamundaPlatformPropertiesProviderModule,
                    minimapModule,
                    EmbeddedComments,
                    ColorPickerModule
                ],
                moddleExtensions: {
                    tags: tagModdleDescriptor,
                    conditions: conditionModdleDescriptor,
                    camunda: CamundaBpmnModdle
                }
            });

            propertiesPanelRef.current = bpmnModelerRef.current.get('propertiesPanel');

            return () => {
                bpmnModelerRef.current.destroy();
            };
        } catch (error) {
            handleError(error.message, true);
        }

    }, []);

    const handleError = (msg, restart) => {
        if (restart)
            setOpen(false);
        setErrorMsg(msg);
        setErrorOccured(true);
    };

    const handleCreateDiagram = () => {
        try {
            const bpmnModeler = bpmnModelerRef.current;
            bpmnModeler.createDiagram((err, warnings) => {
                if (err) {
                    handleError('Failed to create BPMN diagram: ' + err.message, true);
                } else {
                    console.log('BPMN diagram created successfully');
                }
            });
            setOpen(true);
        } catch (error) {
            handleError(error.message, true);
        }
    };

    const handleSaveDiagram = async () => {
        const bpmnModeler = bpmnModelerRef.current;
        try {
            const { xml } = await bpmnModeler.saveXML({ format: true }, function (err, xml) {
            });
            const json = xmlToJson(xml);
            downloadJSON(JSON.stringify(json, null, 4));
        } catch (error) {
            handleError('Error converting BPMN diagram to JSON: ' + error.message);
        }
    };

    const loadDiagram = (event) => {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const fileType = file.name.split('.').pop().toLowerCase();
                let bpmnXML;

                if (fileType === 'bpmn') {
                    bpmnXML = e.target.result;
                } else if (fileType === 'json') {
                    bpmnXML = jsonToXml(JSON.parse(e.target.result), true);
                }
                const modeler = bpmnModelerRef.current;
                modeler.importXML(bpmnXML);
                setOpen(true);
            } catch (error) {
                handleError('Error occured while loading BPMN diagram: ' + error.message);
            }
        };
        if (file)
            reader.readAsText(file);
    };

    const handleLoadDiagram = async () => {
        fileInputRef.current.click();
    };

    const handleDeployDiagram = async (name, variables) => {
        try {
            const { xml } = await bpmnModelerRef.current.saveXML({ format: true }, function (err, xml) {
            });
            let bpmnXML = jsonToXml(xmlToJson(xml));

            const client = new RestClient();
            const res = await client.executeDiagram(name, variables, bpmnXML);

            // fix conversion from engine to modeler
            // if (res.data.message.source) {
            //     bpmnXML = jsonToXml(xmlToJson(res.data.message.source), true);
            //     bpmnModelerRef.current.importXML(bpmnXML);
            // }

            console.log(res);
        } catch (error) {
            handleError('Error occured while deploying diagram: ' + error.message);
        }
    };

    return (
        <div className='editor-container'>
            {
                !isOpen ? (
                    <div className='intro-text'>
                        <div>
                            <button className="create-link" onClick={handleCreateDiagram}>Create a new diagram </button>
                            {' '}or{' '}
                            <label htmlFor="file-input" className="load-link">
                                <span>Load an existing one</span>
                            </label>
                            {' '}to get started.
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="button-container">
                            <button className="action-button create-button" onClick={handleCreateDiagram}>Create</button>
                            <button className="action-button save-button" onClick={handleSaveDiagram}>Save</button>
                            <button className="action-button load-button" onClick={handleLoadDiagram}>Load</button>
                            <button className="action-button deploy-button" onClick={() => setIsModalOpen(true)}>Deploy</button>
                        </div>
                    </div>
                )
            }
            <div id="bpmnview" className={`editor ${isOpen ? 'open' : 'closed'}`}></div>
            <div id="propertiesview" className={`properties-panel ${isOpen ? 'open' : 'closed'}`}></div>
            <input ref={fileInputRef} id="file-input" type="file" accept='.bpmn, .json' style={{ display: 'none' }} onChange={loadDiagram} />
            <div>
                <DeployDiagram
                    isFormOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onDeploy={handleDeployDiagram}
                ></DeployDiagram>

                {errorOccured && <ErrorPanel
                    message={errorMsg}
                    onClose={() => { setErrorOccured(false); setErrorMsg(""); }}>
                </ErrorPanel>}
            </div>
        </div >
    );
};

export default CamundaModeler;
