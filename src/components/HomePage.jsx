import React, {useEffect, useRef} from "react";
import {useDispatch, useSelector} from "react-redux";
import queryString from "query-string";
import {TabPanel, TabView} from "primereact/tabview";
import {Toast} from "primereact/toast";
import {Emulator} from "./Emulator";
import {reset} from "../redux/jsspeccy/actions";

export default function HomePage() {
    const dispatch = useDispatch();

    const toast = useRef(null);

    const zoom = 2;
    const width = zoom * 320;

    useEffect(() => {
        return () => {
            dispatch(reset());
        }
    }, []);

    return (
        <>
            <Toast ref={toast}/>
            <div className="grid" style={{width: "100%", padding: 0, margin: 0}}>
                <div className="col" style={{padding: 0}}>

                </div>
                <div className="col-fixed p-0 pt-2" style={{width: `${width}px`}}>
                    <Emulator zoom={zoom} width={width}/>
                </div>
                <div className="col" style={{padding: 0}}>

                </div>
            </div>
        </>
    )
}
