import React from "react";
import {useDispatch, useSelector} from "react-redux";
import queryString from "query-string";
import {TabPanel, TabView} from "primereact/tabview";
import {DemoSinclairBasicEditor} from "./DemoSinclairBasicEditor";
import {DemoAssemblyEditor} from "./DemoAssemblyEditor";
import {DemoZXBasicEditor} from "./DemoZXBasicEditor";
import {Emulator} from "./Emulator";
import {setSelectedTabIndex} from "../redux/actions/demo";

export default function Demo() {
    const dispatch = useDispatch();
    const activeIndex = useSelector(state => state?.demo.selectedTabIndex);
    const zoom = 2;
    const width = zoom * 320;

    // Hide tabs when loading external tape files.
    const search = useSelector(state => state?.router.location.search);
    const parsed = queryString.parse(search);
    const externalLoad = typeof parsed.u !== 'undefined';

    return (
        <div className="grid"
             style={{width: "100%", padding: 0, margin: 0}}>
            <div className="col" style={{padding: 0}}>

            </div>
            <div className="col-fixed" style={{width: `${width}px`, padding: '6px 0 0 0'}}>
                {externalLoad &&
                    <Emulator zoom={zoom} width={width}/>
                }
                {!externalLoad &&
                    <TabView
                        activeIndex={activeIndex}
                        onTabChange={(e) => dispatch(setSelectedTabIndex(e.index))}>
                        <TabPanel header="Emulator">
                            <Emulator zoom={zoom} width={width}/>
                        </TabPanel>
                        <TabPanel header="Z80 Assembler">
                            <DemoAssemblyEditor/>
                        </TabPanel>
                        <TabPanel header="Sinclair BASIC">
                            <DemoSinclairBasicEditor/>
                        </TabPanel>
                        <TabPanel header="Boriel ZX BASIC">
                            <DemoZXBasicEditor/>
                        </TabPanel>
                    </TabView>
                }
            </div>
            <div className="col" style={{padding: 0}}>

            </div>
        </div>
    )
}
