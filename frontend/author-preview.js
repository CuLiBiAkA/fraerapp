const params=new URLSearchParams(location.search),query=new URLSearchParams();
let english=false;try{english=localStorage.getItem('fraerapp.language')==='en';}catch{}
if(english){document.documentElement.lang='en';document.title='Preview — FraerApp';document.querySelector('header a').textContent='← My stories';document.querySelector('header strong').textContent='Preview · visible only to you';document.querySelector('header label').firstChild.textContent='Screen ';document.querySelectorAll('#device option').forEach((option,i)=>option.textContent=['Desktop','Tablet','Phone'][i]);document.querySelector('#preview').title='Story preview';}
const kind=params.has('previewCollection')?'previewCollection':'previewStory';
if(params.get(kind)){
  query.set(kind,params.get(kind));if(params.get('revision'))query.set('revision',params.get('revision'));
  document.querySelector('#preview').src='/?'+query;
}
document.querySelector('#device').onchange=event=>{document.querySelector('#preview').style.width=event.target.value;};
