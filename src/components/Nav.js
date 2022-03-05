import React, {useEffect, useState} from "react";
import {useDispatch, useSelector} from "react-redux";
import {useHistory} from "react-router-dom";
import {InputText} from "primereact/inputtext";
import {Menubar} from "primereact/menubar";
import {
    pause,
    reset,
    showOpenFileDialog,
    viewFullScreen
} from "../redux/actions/jsspeccy";
import {
    downloadTape,
    hideNewProjectForm,
    setSelectedTabIndex,
    showNewProjectForm
} from "../redux/actions/project";
import {setSelectedTabIndex as setDemoTabIndex} from "../redux/actions/demo";
import {getUserInfo} from "../redux/actions/identity";
import {login, logout} from "../auth";

export default function Nav() {
    const [searchInput, setSearchInput] = useState([]);
    const dispatch = useDispatch();
    const history = useHistory();
    const pathname = useSelector(state => state?.router.location.pathname);
    const selectedDemoTab = useSelector(state => state?.demo.selectedTabIndex);
    const selectedProjectTab = useSelector(state => state?.project.selectedTabIndex);
    const userId = useSelector(state => state?.identity.userId);
    const projectType = useSelector(state => state?.project.type);
    const projectReady = useSelector(state => state?.project.ready);

    const emuVisible =
        pathname === '/' &&
        (
            (!projectType && selectedDemoTab === 0) ||
            (projectType && projectReady && selectedProjectTab === 1)
        );

    const start = <img alt="logo" src="/img/logo.png" height="40" className="mr-2"/>;
    const end = (
        <InputText
            placeholder="Search"
            type="text"
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && searchInput) {
                    history.push(`/search?q=${searchInput}`);
                }
        }}/>
    );

    useEffect(() => {
        dispatch(getUserInfo());
    }, []);

    const items = [
        {
            label: 'ZX Play',
            command: () => {
                dispatch(hideNewProjectForm());
                history.push('/');
            }
        },
        {
            label: 'Project',
            icon: 'pi pi-fw pi-file',
            items: [
                {
                    label: 'New Project',
                    icon: 'pi pi-fw pi-plus',
                    disabled: !userId,
                    items: [
                        {
                            label: 'Boriel ZX BASIC',
                            command: () => {
                                dispatch(pause());
                                dispatch(showNewProjectForm('zxbasic'));
                                history.push('/');
                            }
                        },
                        {
                            label: 'Sinclair BASIC',
                            command: () => {
                                dispatch(pause());
                                dispatch(showNewProjectForm('basic'));
                                history.push('/');
                            }
                        },
                        {
                            label: 'Z80 Assembly',
                            command: () => {
                                dispatch(pause());
                                dispatch(showNewProjectForm('asm'));
                                history.push('/');
                            }
                        }
                    ]
                },
                {
                    label: 'Open Project',
                    icon: 'pi pi-fw pi-folder-open',
                    disabled: !userId,
                    command: () => {
                        history.push('/projects');
                    }
                },
                {
                    separator: true
                },
                {
                    label: 'Upload Tape',
                    icon: 'pi pi-fw pi-upload',
                    command: () => {
                        dispatch(showOpenFileDialog());
                        history.push('/');
                    }
                },
                {
                    label: 'Download Tape',
                    icon: 'pi pi-fw pi-download',
                    disabled: !projectReady,
                    command: () => {
                        dispatch(downloadTape());
                    }
                }
            ]
        },
        {
            label: 'View',
            icon: 'pi pi-fw pi-eye',
            items: [
                {
                    label: 'Full Screen',
                    icon: 'pi pi-fw pi-window-maximize',
                    disabled: !emuVisible,
                    command: () => {
                        dispatch(viewFullScreen());
                    }
                },
                {
                    separator: true
                },
                {
                    label: 'Your Profile',
                    icon: 'pi pi-fw pi-user',
                    disabled: !userId,
                    command: () => {
                        history.push('/profile');
                    }
                },
                {
                    label: 'Your Projects',
                    icon: 'pi pi-fw pi-folder',
                    disabled: !userId,
                    command: () => {
                        history.push('/projects');
                    }
                }
            ]
        },
        {
            label: 'Info',
            icon: 'pi pi-fw pi-info-circle',
            items: [
                {
                    label: 'InfoAbout This Site',
                    icon: 'pi pi-fw pi-question-circle',
                    command: () => {
                        history.push('/about');
                    }
                },
                {
                    label: 'Linking To ZX Play',
                    icon: 'pi pi-fw pi-link',
                    command: () => {
                        history.push('/info/linking');
                    }
                }
            ]
        },
        {
            label: 'Reset',
            icon: 'pi pi-fw pi-power-off',
            command: () => {
                if (projectType) dispatch(setSelectedTabIndex(3));
                else dispatch(setDemoTabIndex(0));
                dispatch(reset());
                history.push('/');
            }
        },
        {
            label: userId ? 'Sign-out' : 'Sign-in',
            icon: userId ? 'pi pi-fw pi-sign-out' : 'pi pi-fw pi-sign-in',
            command: () => {
                userId ? logout() : login()
            }
        }
    ];

    return (
        <div className="px-2 pt-2">
            <Menubar
                model={items}
                start={start}
                end={end}
                // style={{borderRadius: 0}}
            />
        </div>
    );
}
