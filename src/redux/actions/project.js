export const actionTypes = {
    setSelectedTabIndex: 'demo/setSelectedTabIndex',
    newZXBasicProject: 'project/newZXBasicProject',
    newSinclairBasicProject: 'project/newSinclairBasicProject',
    newAssemblyProject: 'project/newAssemblyProject',
    showProjectIndex: 'project/showProjectIndex',
    downloadTape: 'project/downloadTape',
};

export const setSelectedTabIndex = (index) => ({
    type: actionTypes.setSelectedTabIndex,
    index
})

export const newZXBasicProject = () => ({
    type: actionTypes.newZXBasicProject
});

export const newSinclairBasicProject = () => ({
    type: actionTypes.newSinclairBasicProject
});

export const newAssemblyProject = () => ({
    type: actionTypes.newAssemblyProject
});

export const showProjectIndex = () => ({
    type: actionTypes.showProjectIndex
});

export const downloadTape = () => ({
    type: actionTypes.downloadTape
});
