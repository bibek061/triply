'use strict';

// Sample conversations are separate from comments created in this browser.
const sampleComments = [
  {id:'sample-p1-q1',postId:'p1',author:'Riya M.',initials:'RM',text:'Where did you stay?',parentId:null},
  {id:'sample-p1-a1',postId:'p1',author:'Aarav S.',initials:'AS',text:'A small guesthouse near Lakeside. Being able to walk down to the water was my favorite part.',parentId:'sample-p1-q1',isAuthor:true},
  {id:'sample-p1-q2',postId:'p1',author:'Kabir R.',initials:'KR',text:'How much was it?',parentId:null},
  {id:'sample-p1-a2',postId:'p1',author:'Aarav S.',initials:'AS',text:'About NPR 3,500 per room, per night on my trip. Breakfast was extra. That’s what I paid then, so check current rates before booking.',parentId:'sample-p1-q2',isAuthor:true},
  {id:'sample-p2-q1',postId:'p2',author:'Isha P.',initials:'IP',text:'What time did you go? I’d love to explore before it gets busy.',parentId:null},
  {id:'sample-p2-a1',postId:'p2',author:'Meera K.',initials:'MK',text:'Around 7 in the morning. A lovely time for a slow walk and breakfast afterward.',parentId:'sample-p2-q1',isAuthor:true},
];
let localComments = [];
try {
  const stored = JSON.parse(localStorage.getItem('triply-comments') || '[]');
  if (Array.isArray(stored)) localComments = stored.filter(c => c && typeof c.id === 'string' && typeof c.postId === 'string' && typeof c.text === 'string' && c.text.trim().length > 0 && c.text.length <= 500 && (c.parentId === null || typeof c.parentId === 'string')).map(c => ({id:c.id,postId:c.postId,text:c.text,parentId:c.parentId,author:'You',initials:'JD'}));
} catch { /* An unavailable or invalid store starts a fresh local discussion. */ }
const discussionDrafts = new Map();
let activeDiscussion = null;
const quickQuestions = ['Where did you stay?', 'How much was it?'];

function postComments(postId) { return [...sampleComments, ...localComments].filter(c => c.postId === postId); }
function commentCount(postId) { return postComments(postId).length; }
function questionChips(postId) {
  return quickQuestions.map(question => `<button class="question-chip" type="button" data-action="ask-question" data-id="${esc(postId)}" data-question="${esc(question)}">${esc(question)}</button>`).join('');
}
function commentRow(comment, all) {
  const replies = all.filter(c => c.parentId === comment.id);
  const sample = comment.id.startsWith('sample-');
  return `<li class="comment-thread" id="comment-${esc(comment.id)}"><article class="comment-row"><span class="small-avatar ${comment.author === 'You'?'your-avatar':''}">${esc(comment.initials)}</span><div class="comment-content"><div class="comment-byline"><strong>${esc(comment.author)}</strong>${comment.isAuthor?'<span class="author-label">Post author</span>':''}<span class="comment-meta">${sample?'Sample':'Local demo'}</span></div><p>${esc(comment.text)}</p><button class="reply-button" data-action="reply-comment" data-id="${esc(comment.id)}" aria-label="Reply to ${esc(comment.author)}: ${esc(comment.text)}">Reply</button></div></article>${replies.length?`<ol class="comment-replies">${replies.map(reply => commentRow(reply, [])).join('')}</ol>`:''}</li>`;
}
function openComments(postId, question) {
  const post = picks.find(p => p.id === postId);
  if (!post) return;
  const draft = discussionDrafts.get(postId) || {text:'',parentId:null,replyTo:null};
  activeDiscussion = {postId,...draft};
  if (question) Object.assign(activeDiscussion,{text:question,parentId:null,replyTo:null});
  drawDiscussion();
  if (question) document.getElementById('comment-text').focus();
}
function drawDiscussion() {
  const post = picks.find(p => p.id === activeDiscussion.postId);
  const comments = postComments(post.id);
  showModal('A good question goes a long way.',`COMMENTS · ${esc(post.location)}`,`
    <div class="discussion-post"><img src="${post.image}" alt="${esc(post.location)}"><div><span>${esc(post.author)}’s Local Pick</span><h3>${esc(post.title)}</h3><button class="text-link" data-action="nearby" data-city="${post.city}">Find nearby deals ${icon('arrow')}</button></div></div>
    <div class="discussion-heading"><h3>Conversation <span>${comments.length}</span></h3><span>Ask. Share. Help someone go.</span></div>
    <div class="comment-list" aria-label="Post comments">${comments.length?`<ol>${comments.filter(c=>!c.parentId).map(c=>commentRow(c,comments)).join('')}</ol>`:`<div class="no-comments">${icon('comment')}<strong>Be the first to ask.</strong><p>Curious about the stay, the cost, or the best time to visit?</p></div>`}</div>
    <form id="comment-form" class="comment-form">
      <div id="reply-context" class="reply-context" ${activeDiscussion.parentId?'':'hidden'}><span>Replying to <strong id="reply-author">${esc(activeDiscussion.replyTo || '')}</strong></span><button type="button" data-action="cancel-reply" aria-label="Cancel reply">×</button></div>
      <label for="comment-text" id="composer-label">${activeDiscussion.parentId?'Your reply':'Ask a question or share a tip'}</label>
      <div class="quick-questions">${questionChips(post.id)}</div>
      <textarea id="comment-text" name="comment" rows="3" maxlength="500" required placeholder="What would you like to know?" aria-describedby="comment-error comment-demo-note">${esc(activeDiscussion.text)}</textarea>
      <div class="composer-bottom"><span id="comment-counter">${activeDiscussion.text.length}/500</span><button type="submit" class="primary-button" id="comment-submit" ${activeDiscussion.text.trim()?'':'disabled'}>${activeDiscussion.parentId?'Post reply':'Post comment'} ${icon('arrow')}</button></div>
      <div class="search-error" id="comment-error" role="alert"></div>
      <p class="comment-demo-note" id="comment-demo-note">Demo conversation. Your comments stay in this browser; sample travelers won’t receive or reply to them.</p>
    </form>`);
  modal.classList.add('discussion-modal');
}
function rememberDiscussionDraft() {
  if (!activeDiscussion) return;
  const {postId,text,parentId,replyTo} = activeDiscussion;
  discussionDrafts.set(postId,{text,parentId,replyTo});
}
function setReply(comment) {
  // Replies to replies stay in the original conversation thread.
  activeDiscussion.parentId = comment ? comment.parentId || comment.id : null;
  activeDiscussion.replyTo = comment?.author || null;
  const context=document.getElementById('reply-context');
  context.hidden=!comment;
  document.getElementById('reply-author').textContent=comment?.author || '';
  document.getElementById('composer-label').textContent=comment?'Your reply':'Ask a question or share a tip';
  document.getElementById('comment-submit').innerHTML=`${comment?'Post reply':'Post comment'} ${icon('arrow')}`;
  rememberDiscussionDraft();
  document.getElementById('comment-text').focus();
}
document.addEventListener('click', event => {
  const button=event.target.closest('[data-action]');
  if(!button)return;
  const {action,id,question}=button.dataset;
  if(action==='comments')openComments(id);
  if(action==='ask-question'){
    if(activeDiscussion?.postId===id && document.getElementById('comment-form')) {
      const input=document.getElementById('comment-text');
      input.value=question;
      activeDiscussion.text=question;
      setReply(null);
      input.dispatchEvent(new Event('input',{bubbles:true}));
    } else openComments(id,question);
  }
  if(action==='reply-comment' && activeDiscussion) {
    const comment=postComments(activeDiscussion.postId).find(c=>c.id===id);
    if(comment)setReply(comment);
  }
  if(action==='cancel-reply' && activeDiscussion)setReply(null);
});
document.addEventListener('input',event=>{
  if(event.target.id!=='comment-text' || !activeDiscussion)return;
  activeDiscussion.text=event.target.value;
  rememberDiscussionDraft();
  document.getElementById('comment-counter').textContent=`${event.target.value.length}/500`;
  document.getElementById('comment-submit').disabled=!event.target.value.trim();
  document.getElementById('comment-error').textContent='';
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='comment-form' || !activeDiscussion)return;
  event.preventDefault();
  const text=new FormData(event.target).get('comment').trim();
  if(!text || text.length>500){document.getElementById('comment-error').textContent='Write a comment between 1 and 500 characters.';return;}
  const comment={id:crypto.randomUUID(),postId:activeDiscussion.postId,parentId:activeDiscussion.parentId,author:'You',initials:'JD',text};
  const next=[...localComments,comment];
  try { localStorage.setItem('triply-comments',JSON.stringify(next)); }
  catch {document.getElementById('comment-error').textContent='Your browser could not save this comment. Your draft is still here; please try again.';return;}
  localComments=next;
  activeDiscussion={postId:comment.postId,text:'',parentId:null,replyTo:null};
  discussionDrafts.delete(comment.postId);
  render();
  drawDiscussion();
  document.getElementById(`comment-${comment.id}`).scrollIntoView({block:'nearest'});
  document.getElementById('comment-text').focus({preventScroll:true});
  document.getElementById('comment-error').textContent='Comment saved in this browser.';
});
document.addEventListener('DOMContentLoaded',()=>{
  modal.addEventListener('close',()=>{
    rememberDiscussionDraft();
    activeDiscussion=null;
    modal.classList.remove('discussion-modal');
  });
});
