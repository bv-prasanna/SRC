package in.srcenterprises.api;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.util.List;
@RestController
public class CatalogController {
  private final CatalogRepository repo;
  public CatalogController(CatalogRepository repo){this.repo=repo;}
  @GetMapping("/api/catalog/products") public List<CatalogItem> publicCatalog(){return repo.findAllByPublishedTrueOrderByNameAsc();}
  @GetMapping("/api/admin/products") public List<CatalogItem> all(){return repo.findAll();}
  @PostMapping("/api/admin/products") public ResponseEntity<CatalogItem> create(@Valid @RequestBody CatalogItem item){
    item.id=null;item.version=null;validate(item);var saved=repo.save(item);return ResponseEntity.created(URI.create("/api/admin/products/"+saved.id)).body(saved);
  }
  @PutMapping("/api/admin/products/{id}") public CatalogItem update(@PathVariable Long id,@Valid @RequestBody CatalogItem input){
    var existing=repo.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND));
    validate(input);existing.name=input.name;existing.category=input.category;existing.description=input.description;existing.imageUrl=input.imageUrl;existing.demoVideoUrl=input.demoVideoUrl;existing.published=input.published;existing.fireworks=input.fireworks;return repo.save(existing);
  }
  @DeleteMapping("/api/admin/products/{id}") public ResponseEntity<Void> delete(@PathVariable Long id){
    if(!repo.existsById(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    repo.deleteById(id);return ResponseEntity.noContent().build();
  }
  private void validate(CatalogItem item){for(String url:List.of(item.imageUrl==null?"":item.imageUrl,item.demoVideoUrl==null?"":item.demoVideoUrl)){if(!url.isBlank()){try{var uri=URI.create(url);if(!"https".equals(uri.getScheme())||uri.getHost()==null)throw new IllegalArgumentException();}catch(Exception e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Media URLs must be absolute HTTPS URLs");}}}}
}
