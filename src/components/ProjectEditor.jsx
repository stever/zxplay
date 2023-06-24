import React, {useEffect, useRef} from "react";
import {useDispatch, useSelector} from "react-redux";
import {Button} from "primereact/button";
import {ConfirmPopup, confirmPopup} from "primereact/confirmpopup";
import CodeMirror from "./CodeMirror";
import "codemirror/mode/z80/z80";
import {deleteProject, saveCodeChanges} from "../redux/project/actions";
import {setCode} from "../redux/project/actions";
import {runProjectCode} from "../redux/eightbit/actions";
import "../lib/syntax/pasmo";
import "../lib/syntax/zmac";
import "../lib/syntax/zmakebas";
import "../lib/syntax/z88dk-c";
import "../lib/syntax/sdcc";
import "../lib/syntax/zxbasic";
import {dashboardLock} from "../dashboard_lock";

export function ProjectEditor() {
    const dispatch = useDispatch();
    const cmRef = useRef(null);
    const lang = useSelector(state => state?.project.lang);
    const code = useSelector(state => state?.project.code);
    const savedCode = useSelector(state => state?.project.savedCode);

    let mode;
    switch (lang) {
        case 'asm':
            mode = 'text/x-pasmo';
            break;
        case 'basic':
            mode = 'text/x-zmakebas';
            break;
        case 'bas2tap':
            mode = 'text/x-zmakebas';
            break;
        case 'c':
            mode = 'text/x-z88dk-csrc';
            break;
        case 'sdcc':
            mode = 'text/x-sdcc-csrc';
            break;
        case 'zmac':
            mode = 'text/x-zmac';
            break;
        case 'zxbasic':
            mode = 'text/x-zxbasic';
            break;
        default:
            throw `unexpected case: ${lang}`;
    }

    const options = {
        mode,
        theme: 'mbo',
        readOnly: false,
        lineWrapping: false,
        lineNumbers: true,
        matchBrackets: true,
        tabSize: 4,
        indentAuto: true
    };

    useEffect(() => {
        const cm = cmRef.current.getCodeMirror();
        cm.setValue(code || '');
        dispatch(setCode(cm.getValue()))
    }, []);

    const deleteConfirm = (event) => {
        confirmPopup({
            target: event.currentTarget,
            message: 'Are you sure you want to permanently remove this project?',
            icon: 'pi pi-exclamation-triangle',
            accept: () => dispatch(deleteProject()),
            reject: () => {}
        });
    }

    return (
        <>
            <CodeMirror
                ref={cmRef}
                options={options}
                onChange={(cm, _) => dispatch(setCode(cm.getValue()))}
            />
            <Button
                label="Run"
                icon="pi pi-play"
                className="mt-2 mr-2"
                onClick={() => {
                    dashboardLock();
                    dispatch(runProjectCode());
                }}
            />
            <Button
                label="Save"
                icon="pi pi-save"
                className="p-button-outlined mt-2 mr-2"
                disabled={code === savedCode}
                onClick={() => dispatch(saveCodeChanges())}
            />
            <Button
                label="Delete"
                icon="pi pi-times"
                className="p-button-outlined p-button-danger mt-2"
                onClick={(e) => deleteConfirm(e)}
            />
            <ConfirmPopup/>
        </>
    )
}
