import React, {useEffect, useState} from "react";
import {useDispatch, useSelector} from "react-redux";
import {useNavigate} from "react-router-dom";
import {InputText} from "primereact/inputtext";
import {Menubar} from "primereact/menubar";
import {
    pause,
    showOpenFileDialog,
    viewFullScreen
} from "../redux/jsspeccy/actions";
import {downloadProjectTap} from "../redux/eightbit/actions";
import {getUserInfo} from "../redux/identity/actions";
import {login, logout} from "../auth";
import {resetEmulator} from "../redux/app/actions";
import Constants from "../constants";

export default function Nav() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const [searchInput, setSearchInput] = useState('');

    const pathname = useSelector(state => state?.router.location.pathname);
    const selectedDemoTab = useSelector(state => state?.demo.selectedTabIndex);
    const userId = useSelector(state => state?.identity.userId);
    const lang = useSelector(state => state?.project.lang);

    const emuVisible = (pathname === '/' && selectedDemoTab === 0) || pathname.startsWith('/projects/');

    const start = <img alt="logo" src="/logo.png" height={"40"} className="mr-2"/>;
    const end = (
        <InputText
            placeholder="Search"
            type="text"
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && searchInput) {
                    navigate(`/search?q=${searchInput}`);
                }
        }}/>
    );

    useEffect(() => {
        dispatch(getUserInfo());
    }, []);

    const items = getMenuItems(navigate, userId, dispatch, lang, emuVisible);

    return (
        <div className="px-2 pt-2">
            <Menubar
                model={items}
                start={start}
                end={end}
                style={{
                    borderRadius: '5px',
                    borderColor: '#1E1E1E'
                }}
            />
        </div>
    );
}

function getMenuItems(navigate, userId, dispatch, lang, emuVisible) {
    const sep = {
        separator: true
    };

    const homeButton = {
        label: 'ZX Play',
        command: () => {
            navigate('/');
        }
    };

    const newPasmo = {
        label: 'Pasmo',
        command: () => {
            dispatch(pause());
            navigate('/new/asm');
        }
    };

    const newZmac = {
        label: 'zmac',
        command: () => {
            dispatch(pause());
            navigate('/new/zmac');
        }
    };

    const newBoriel = {
        label: 'Boriel ZX',
        command: () => {
            dispatch(pause());
            navigate('/new/zxbasic');
        }
    };

    const newBasic = {
        label: 'Sinclair (zmakebas)',
        command: () => {
            dispatch(pause());
            navigate('/new/basic');
        }
    };

    const newBas2Tap = {
        label: 'Sinclair (bas2tap)',
        command: () => {
            dispatch(pause());
            navigate('/new/bas2tap');
        }
    };

    const newZ88dk = {
        label: 'z88dk zcc',
        command: () => {
            dispatch(pause());
            navigate('/new/c');
        }
    };

    const newSdcc = {
        label: 'SDCC',
        command: () => {
            dispatch(pause());
            navigate('/new/sdcc');
        }
    };

    const z80Menu = {
        label: 'Z80 Assembly',
        items: []
    };

    z80Menu.items.push(newPasmo);
    z80Menu.items.push(newZmac);

    const basicMenu = {
        label: 'BASIC',
        items: []
    };

    basicMenu.items.push(newBasic);
    basicMenu.items.push(newBas2Tap);

    // NOTE: Boriel ZX Basic projects are supported by an API which is not currently provided in production.
    if (Constants.isDev) basicMenu.items.push(newBoriel);

    const cMenu = {
        label: 'C',
        items: []
    };

    cMenu.items.push(newSdcc);

    // NOTE: Z88DK projects are supported by an API which is not currently provided in production.
    if (Constants.isDev) cMenu.items.push(newZ88dk);

    const projectMenu = {
        label: 'Project',
        icon: 'pi pi-fw pi-file',
        items: [
            {
                label: 'New Project',
                icon: 'pi pi-fw pi-plus',
                disabled: !userId,
                items: [
                    z80Menu,
                    basicMenu,
                    cMenu,
                ]
            },
            {
                label: 'Open Project',
                icon: 'pi pi-fw pi-folder-open',
                disabled: !userId,
                command: () => {
                    navigate(`/u/${userId}/projects`);
                }
            },
            {
                separator: true
            },
            {
                label: 'Upload TAP',
                icon: 'pi pi-fw pi-upload',
                command: () => {
                    dispatch(showOpenFileDialog());
                    navigate('/');
                }
            },
            {
                label: 'Download TAP',
                icon: 'pi pi-fw pi-download',
                disabled: typeof lang === 'undefined',
                command: () => {
                    dispatch(downloadProjectTap());
                }
            }
        ]
    };

    const viewFullScreenMenuItem = {
        label: 'Full Screen',
        icon: 'pi pi-fw pi-window-maximize',
        disabled: !emuVisible,
        command: () => {
            dispatch(viewFullScreen());
        }
    };

    const viewProfileMenuItem = {
        label: 'Your Profile',
        icon: 'pi pi-fw pi-user',
        disabled: !userId,
        command: () => {
            navigate(`/u/${userId}`);
        }
    };

    const viewProjectsMenuItem = {
        label: 'Your Projects',
        icon: 'pi pi-fw pi-folder',
        disabled: !userId,
        command: () => {
            navigate(`/u/${userId}/projects`);
        }
    };

    const viewMenu = {
        label: 'View',
        icon: 'pi pi-fw pi-eye',
        items: []
    };

    viewMenu.items.push(viewFullScreenMenuItem);
    viewMenu.items.push(sep);

    // NOTE: Projects not implemented so menu item is only shown in development.
    if (Constants.isDev) viewMenu.items.push(viewProfileMenuItem);
    
    viewMenu.items.push(viewProjectsMenuItem);

    const infoMenu = {
        label: 'Info',
        icon: 'pi pi-fw pi-info-circle',
        items: [
            {
                label: 'About This Site',
                icon: 'pi pi-fw pi-question-circle',
                command: () => {
                    navigate('/about');
                }
            },
            {
                label: 'Linking To ZX Play',
                icon: 'pi pi-fw pi-link',
                command: () => {
                    navigate('/info/linking');
                }
            },
            {
                label: 'Privacy Policy',
                icon: 'pi pi-fw pi-eye',
                command: () => {
                    navigate('/legal/privacy-policy');
                }
            },
            {
                label: 'Terms of Use',
                icon: 'pi pi-fw pi-info-circle',
                command: () => {
                    navigate('/legal/terms-of-use');
                }
            }
        ]
    };

    const resetButton = {
        label: 'Reset',
        icon: 'pi pi-fw pi-power-off',
        command: () => {
            dispatch(resetEmulator());
        }
    };

    const loginButton = {
        label: userId ? 'Sign-out' : 'Sign-in',
        icon: userId ? 'pi pi-fw pi-sign-out' : 'pi pi-fw pi-sign-in',
        command: () => {
            userId ? logout() : login()
        }
    };

    return [
        homeButton,
        projectMenu,
        viewMenu,
        infoMenu,
        resetButton,
        loginButton
    ];
}
