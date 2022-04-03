import {takeLatest, put, select, call} from "redux-saga/effects";
import {push} from "connected-react-router";
import gql from "graphql-tag";
import zmakebas from "zmakebas";
import pasmo from "pasmo";
import {gqlFetch} from "../../graphql_fetch";
import {store} from "../store";
import {actionTypes, reset, receiveLoadedProject, setSavedCode} from "../actions/project";
import {loadTape, pause, reset as resetMachine} from "../actions/jsspeccy";

// -----------------------------------------------------------------------------
// Action watchers
// -----------------------------------------------------------------------------

// noinspection JSUnusedGlobalSymbols
export function* watchForSetSelectedTabIndexActions() {
    yield takeLatest(actionTypes.setSelectedTabIndex, handleSetSelectedTabIndexActions);
}

// noinspection JSUnusedGlobalSymbols
export function* watchForCreateNewProjectActions() {
    yield takeLatest(actionTypes.createNewProject, handleCreateNewProjectActions);
}

// noinspection JSUnusedGlobalSymbols
export function* watchForLoadProjectActions() {
    yield takeLatest(actionTypes.loadProject, handleLoadProjectActions);
}

// noinspection JSUnusedGlobalSymbols
export function* watchForRunCodeActions() {
    yield takeLatest(actionTypes.runCode, handleRunCodeActions);
}

// noinspection JSUnusedGlobalSymbols
export function* watchForSaveCodeChangesActions() {
    yield takeLatest(actionTypes.saveCodeChanges, handleSaveCodeChangesActions);
}

// noinspection JSUnusedGlobalSymbols
export function* watchForDeleteProjectActions() {
    yield takeLatest(actionTypes.deleteProject, handleDeleteProjectActions);
}

// noinspection JSUnusedGlobalSymbols
export function* watchForDownloadTapeActions() {
    yield takeLatest(actionTypes.downloadTape, handleDownloadTapeActions);
}

// -----------------------------------------------------------------------------
// Action handlers
// -----------------------------------------------------------------------------

function* handleSetSelectedTabIndexActions(_) {
    yield put(pause());
}

function* handleCreateNewProjectActions(action) {
    try {
        const query = gql`
            mutation ($title: String!, $lang: String!) {
                insert_project_one(object: {title: $title, lang: $lang}) {
                    project_id
                }
            }
        `;

        const variables = {
            'title': action.title,
            'lang': action.lang
        };

        const userId = yield select((state) => state.identity.userId);
        const response = yield gqlFetch(userId, query, variables);
        console.assert(response?.data?.insert_project_one?.project_id, response);

        const id = response?.data?.insert_project_one?.project_id;
        yield put(receiveLoadedProject(id, action.title, action.lang, ''));
        yield put(push(`/projects/${id}`));
    } catch (e) {
        console.error(e);
    }
}

function* handleLoadProjectActions(action) {
    try {
        const query = gql`
            query ($project_id: uuid!) {
                project_by_pk(project_id: $project_id) {
                    title
                    lang
                    code
                }
            }
        `;

        const variables = {
            'project_id': action.id
        };

        const userId = yield select((state) => state.identity.userId);
        const response = yield gqlFetch(userId, query, variables);
        if (!response) {
            return;
        }

        const proj = response.data.project_by_pk;
        if (proj) {
            yield put(receiveLoadedProject(action.id, proj.title, proj.lang, proj.code));
        }
    } catch (e) {
        console.error(e);
    }
}

function* handleRunCodeActions(_) {
    try {
        const lang = yield select((state) => state.project.lang);
        const code = yield select((state) => state.project.code);
        const userId = yield select((state) => state.identity.userId);

        switch (lang) {
            case 'asm':
                const pasmoTap = yield pasmo(code);
                store.dispatch(loadTape(pasmoTap));
                break;
            case 'basic':
                const basTap = yield zmakebas(code);
                store.dispatch(loadTape(basTap));
                break;
            case 'c':
                yield runC(code, userId);
                break;
            case 'sdcc':
                // TODO
                break;
            case 'zmac':
                // TODO
                break;
            case 'zxbasic':
                yield call(runZXBasic, code, userId);
                break;
        }
    } catch (e) {
        console.error(e);
    }
}

function* handleSaveCodeChangesActions(_) {
    try {
        const id = yield select((state) => state.project.id);
        const code = yield select((state) => state.project.code);

        const query = gql`
            mutation ($project_id: uuid!, $code: String!) {
                update_project_by_pk(pk_columns: {project_id: $project_id}, _set: {code: $code}) {
                    project_id
                }
            }
        `;

        const variables = {
            'project_id': id,
            'code': code
        };

        const userId = yield select((state) => state.identity.userId);
        const response = yield gqlFetch(userId, query, variables);
        console.assert(response?.data?.update_project_by_pk?.project_id, response);

        yield put(setSavedCode(code));
    } catch (e) {
        console.error(e);
    }
}

function* handleDeleteProjectActions(_) {
    try {
        const id = yield select((state) => state.project.id);

        const query = gql`
            mutation ($project_id: uuid!) {
                delete_project_by_pk(project_id: $project_id) {
                    project_id
                }
            }
        `;

        const variables = {
            'project_id': id
        };

        const userId = yield select((state) => state.identity.userId);
        const response = yield gqlFetch(userId, query, variables);
        console.assert(response?.data?.delete_project_by_pk?.project_id, response);
        yield put(reset());
        yield put(resetMachine());

        yield put(push(`/u/${userId}/projects`));
    } catch (e) {
        console.error(e);
    }
}

function* handleDownloadTapeActions(_) {
    try {
        const lang = yield select((state) => state.project.lang);
        const code = yield select((state) => state.project.code);
        const userId = yield select((state) => state.identity.userId);

        // Get .tap file for download.
        let tap;
        switch (lang) {
            case 'asm':
                tap = yield call(pasmo, code);
                break;
            case 'basic':
                tap = yield call(zmakebas, code);
                break;
            case 'c':
                tap = yield call(getCTape, code, userId);
                break;
            case 'sdcc':
                break;
            case 'zmac':
                break;
            case 'zxbasic':
                tap = yield call(getZXBasicTape, code, userId);
                break;
            default:
                // noinspection ExceptionCaughtLocallyJS
                throw `unexpected case: ${lang}`;
        }

        // Cause the download of the tap file using browser download.
        const blob = new Blob([tap], {type: 'application/octet-stream'});
        const objURL = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = 'project.tap';
        link.href = objURL;
        link.click();
    } catch (e) {
        console.error(e);
    }
}

// -----------------------------------------------------------------------------
// Supporting functions
// -----------------------------------------------------------------------------

async function runZXBasic(code, userId) {
    const tap = await getZXBasicTape(code, userId);
    store.dispatch(loadTape(tap));
}

async function getZXBasicTape(code, userId) {
    const query = gql`
        mutation ($basic: String!) {
            compile(basic: $basic) {
                base64_encoded
            }
        }
    `;

    const variables = {
        'basic': code
    };

    const response = await gqlFetch(userId, query, variables);
    console.assert(response?.data?.compile, response);

    const base64 = response.data.compile.base64_encoded;
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

async function runC(code, userId) {
    const tap = await getCTape(code, userId);
    store.dispatch(loadTape(tap));
}

async function getCTape(code, userId) {
    const query = gql`
        mutation ($code: String!) {
            compileC(code: $code) {
                base64_encoded
            }
        }
    `;

    const variables = {
        'code': code
    };

    const response = await gqlFetch(userId, query, variables);
    console.assert(response?.data?.compileC, response);

    const base64 = response.data.compileC.base64_encoded;
    return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}
