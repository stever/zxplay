export const actionTypes = {
    reset: 'eightbit/reset',
    handleWorkerMessage: 'eightbit/handleWorkerMessage',
    runProjectCode: 'eightbit/runProjectCode',
    downloadProjectTap: 'eightbit/downloadProjectTap',
    getProjectTap: 'eightbit/getProjectTap',
    getSdccTap: 'eightbit/getSdccTap',
    getZmacTap: 'eightbit/getZmacTap',
    setFollowTapAction: 'eightbit/setFollowTapAction',
    browserTapDownload: 'eightbit/browserTapDownload',
    runTap: 'eightbit/runTap',
};

export const handleWorkerMessage = (msg) => ({
    type: actionTypes.handleWorkerMessage,
    msg
});

export const runProjectCode = () => ({
    type: actionTypes.runProjectCode
});

export const downloadProjectTap = () => ({
    type: actionTypes.downloadProjectTap
});

export const getProjectTap = () => ({
    type: actionTypes.getProjectTap
});

export const getSdccTap = () => ({
    type: actionTypes.getSdccTap
});

export const getZmacTap = () => ({
    type: actionTypes.getZmacTap
});

export const setFollowTapAction = (followTapAction) => ({
    type: actionTypes.setFollowTapAction,
    followTapAction
});

export const browserTapDownload = (tap) => ({
    type: actionTypes.browserTapDownload,
    tap
});

export const runTap = (tap) => ({
    type: actionTypes.runTap,
    tap
});
